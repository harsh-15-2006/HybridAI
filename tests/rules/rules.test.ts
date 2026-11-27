// Runs against the Firestore emulator: npm run test:rules
// The real service functions are exercised, so these cover both the rules and the transactions.
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRODUCTS, SHIPPING_CONFIG, STORE_CONFIG } from '../../src/data/seed/catalogue.ts';
import type { Order, Product, Ticket } from '../../src/domain/types.ts';
import { SAMPLE_ADDRESS } from '../../src/features/checkout/validate.ts';
import {
  createTicket, decideReturn, listOrders, listTickets, moderateReview, pendingReviews, placeOrder, replyToTicket,
  requestReturn, setOrderStatus, setStock, StockError, submitReview,
} from '../../src/store/orders.ts';

let env: RulesTestEnvironment;

const asUser = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const asAdmin = () => env.authenticatedContext('op', { admin: true }).firestore() as unknown as Firestore;
const asAnonymous = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

const product = async (id: string) => (await getDoc(doc(asAnonymous(), 'products', id))).data() as Product;
const readOrder = async (db: Firestore, id: string) => ({ ...(await getDoc(doc(db, 'orders', id))).data(), id }) as Order;

const buy = (db: Firestore, uid: string, cart: [string, number][], shippingOptionId = 'standard') =>
  placeOrder(db, { uid, cart: cart.map(([productId, qty]) => ({ productId, qty })), shippingOptionId, address: SAMPLE_ADDRESS });

async function deliver(orderId: string) {
  for (const status of ['packed', 'shipped', 'delivered'] as const) await setOrderStatus(asAdmin(), orderId, status);
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-hybridcart',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    for (const { id, ...data } of PRODUCTS) await setDoc(doc(db, 'products', id), data);
    await setDoc(doc(db, 'config', 'shipping'), SHIPPING_CONFIG);
    await setDoc(doc(db, 'config', 'store'), STORE_CONFIG);
  });
});

describe('catalogue and config', () => {
  it('is readable by anyone and writable only by an operator', async () => {
    await assertSucceeds(getDoc(doc(asAnonymous(), 'products', 'aeris-q40')));
    await assertSucceeds(getDoc(doc(asAnonymous(), 'config', 'shipping')));
    await assertFails(updateDoc(doc(asUser('u1'), 'products', 'aeris-q40'), { priceCents: 1 }));
    await assertFails(updateDoc(doc(asUser('u1'), 'products', 'aeris-q40'), { stock: 999 }));
    await assertFails(updateDoc(doc(asUser('u1'), 'products', 'aeris-q40'), { stock: 0, lastOrderId: 'made-up' }));
    await assertFails(setDoc(doc(asUser('u1'), 'config', 'shipping'), { options: {} }));
    await assertSucceeds(setStock(asAdmin(), 'aeris-q40', 30));
  });
});

describe('placing an order', () => {
  it('creates the order and reduces stock together', async () => {
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 2], ['breeza-mini', 1]], 'express');
    const order = await readOrder(asUser('u1'), id);
    expect(order).toMatchObject({ uid: 'u1', status: 'placed', subtotalCents: 3_099_700, totalCents: 3_124_600 });
    expect((await product('aeris-q40')).stock).toBe(12);
    expect((await product('breeza-mini')).stock).toBe(16);
  });

  it('accepts the maximum of five lines', async () => {
    const lines: [string, number][] = [['aeris-q40', 1], ['lumen-nc2', 2], ['strata-air-pro', 1], ['pebble-buds', 1], ['vela-14', 1]];
    await expect(buy(asUser('u1'), 'u1', lines)).resolves.toBeTruthy();
    expect((await product('lumen-nc2')).stock).toBe(7);
  });

  it('refuses more than is in stock and changes nothing', async () => {
    await expect(buy(asUser('u1'), 'u1', [['aeris-q40', 1], ['hearth-one', 1]])).rejects.toBeInstanceOf(StockError);
    expect((await product('aeris-q40')).stock).toBe(14);
    expect(await listOrders(asUser('u1'), 'u1')).toHaveLength(0);
  });

  it('never oversells under concurrent orders', async () => {
    // vela-16 has 3 units; two shoppers each try to take 2.
    const results = await Promise.allSettled([
      buy(asUser('u1'), 'u1', [['vela-16', 2]]),
      buy(asUser('u2'), 'u2', [['vela-16', 2]]),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await product('vela-16')).stock).toBe(1);
  });

  it('refuses an order written for another user', async () => {
    await assertFails(buy(asUser('u1'), 'u2', [['aeris-q40', 1]]));
    await assertFails(buy(asAnonymous(), 'u1', [['aeris-q40', 1]]));
  });

  it('refuses forged orders written directly', async () => {
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 1]]);
    const genuine: Partial<Order> = await readOrder(asUser('u1'), id);
    delete genuine.id;
    // A new order document without the matching stock write, and with cheaper figures.
    await assertFails(setDoc(doc(asUser('u1'), 'orders', 'forged'), genuine));
    await assertFails(setDoc(doc(asUser('u1'), 'orders', 'forged2'), { ...genuine, totalCents: 1, subtotalCents: 1 }));
  });

  it('refuses an order with a wrong price, total or shipping charge', async () => {
    const { writeBatch } = await import('firebase/firestore');
    const attempt = (change: (o: Record<string, unknown>) => void) => {
      const db = asUser('u1');
      const batch = writeBatch(db);
      const order: Record<string, unknown> = {
        uid: 'u1',
        items: [{ productId: 'aeris-q40', name: 'Aeris Q40', qty: 1, unitPriceCents: 1_199_900 }],
        quantities: { 'aeris-q40': 1 },
        subtotalCents: 1_199_900,
        shipping: { optionId: 'standard', ...SHIPPING_CONFIG.options.standard },
        totalCents: 1_209_800,
        address: SAMPLE_ADDRESS,
        payment: { provider: 'simulated', status: 'simulated_ok' },
        status: 'placed',
        statusHistory: [{ status: 'placed', atMs: Date.now(), by: 'shopper' }],
        createdAtMs: Date.now(),
        deliveredAtMs: null,
      };
      change(order);
      batch.set(doc(db, 'orders', 'o1'), order);
      batch.update(doc(db, 'products', 'aeris-q40'), { stock: 13, lastOrderId: 'o1' });
      return batch.commit();
    };
    await assertFails(attempt((o) => { o.items = [{ productId: 'aeris-q40', name: 'Aeris Q40', qty: 1, unitPriceCents: 100 }]; o.subtotalCents = 100; o.totalCents = 10_000; }));
    await assertFails(attempt((o) => { o.totalCents = 100; }));
    await assertFails(attempt((o) => { o.shipping = { optionId: 'standard', ...SHIPPING_CONFIG.options.standard, priceCents: 0 }; o.totalCents = 1_199_900; }));
    await assertFails(attempt((o) => { o.status = 'delivered'; }));
    await assertFails(attempt((o) => { o.quantities = { 'aeris-q40': 1, 'vela-14': 3 }; }));
    // The untouched version is accepted, so the failures above are caused by the changes.
    await assertSucceeds(attempt(() => {}));
  });
});

describe('ownership and operator access', () => {
  it('keeps orders private to their owner and operators', async () => {
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 1]]);
    await assertSucceeds(getDoc(doc(asUser('u1'), 'orders', id)));
    await assertSucceeds(getDoc(doc(asAdmin(), 'orders', id)));
    await assertFails(getDoc(doc(asUser('u2'), 'orders', id)));
    await assertFails(getDocs(collection(asUser('u2'), 'orders')));
    await assertSucceeds(getDocs(query(collection(asUser('u1'), 'orders'), where('uid', '==', 'u1'))));
    await assertSucceeds(getDocs(collection(asAdmin(), 'orders')));
  });

  it('lets only an operator move an order, in sequence', async () => {
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 1]]);
    await assertFails(setOrderStatus(asUser('u1'), id, 'packed'));
    await expect(setOrderStatus(asAdmin(), id, 'delivered')).rejects.toThrow();
    await assertFails(updateDoc(doc(asAdmin(), 'orders', id), { totalCents: 1 }));
    await deliver(id);
    const order = await readOrder(asUser('u1'), id);
    expect(order.status).toBe('delivered');
    expect(order.deliveredAtMs).toBeGreaterThan(0);
    expect(order.statusHistory.map((e) => e.status)).toEqual(['placed', 'packed', 'shipped', 'delivered']);
  });

  it('returns units to stock when an operator cancels', async () => {
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 3]]);
    await setOrderStatus(asAdmin(), id, 'cancelled');
    expect((await product('aeris-q40')).stock).toBe(14);
  });

  it('does not let a user claim to be an operator through data', async () => {
    await assertFails(setStock(asUser('u1'), 'aeris-q40', 100));
    await assertFails(pendingReviews(asUser('u1')));
  });
});

describe('returns, support and reviews', () => {
  it('accepts a return only for the owner after delivery', async () => {
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 1]]);
    await assertSucceeds(getDoc(doc(asUser('u1'), 'returns', id)));
    await assertFails(requestReturn(asUser('u1'), 'u1', id, 'Changed my mind'));
    await deliver(id);
    await assertFails(requestReturn(asUser('u2'), 'u2', id, 'Not mine'));
    await assertSucceeds(requestReturn(asUser('u1'), 'u1', id, 'Too tight'));
    await assertFails(decideReturn(asUser('u1'), id, 'approved'));
    await assertFails(decideReturn(asAdmin(), id, 'refunded_simulated'));
    await assertSucceeds(decideReturn(asAdmin(), id, 'approved'));
    await assertSucceeds(decideReturn(asAdmin(), id, 'refunded_simulated'));
  });

  it('refuses a return after the window closes', async () => {
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 1]]);
    await deliver(id);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore() as unknown as Firestore, 'orders', id), { deliveredAtMs: Date.now() - 30 * 86_400_000 });
    });
    await assertFails(requestReturn(asUser('u1'), 'u1', id, 'Late'));
  });

  it('keeps support tickets private and replies to operators', async () => {
    await createTicket(asUser('u1'), 'u1', null, 'Hello');
    const [ticket] = (await listTickets(asUser('u1'), 'u1')) as [Ticket];
    await assertFails(getDoc(doc(asUser('u2'), 'supportTickets', ticket.id)));
    await assertFails(replyToTicket(asUser('u1'), ticket, 'Fake store reply'));
    await assertSucceeds(replyToTicket(asAdmin(), ticket, 'We can help.'));
    const [updated] = (await listTickets(asUser('u1'), 'u1')) as [Ticket];
    expect(updated.status).toBe('answered');
  });

  it('takes reviews only from delivered buyers and publishes through an operator', async () => {
    await assertFails(submitReview(asUser('u1'), 'u1', 'aeris-q40', 'none', 5, 'Great'));
    const id = await buy(asUser('u1'), 'u1', [['aeris-q40', 1]]);
    await assertFails(submitReview(asUser('u1'), 'u1', 'aeris-q40', id, 5, 'Too early'));
    await deliver(id);
    await assertFails(submitReview(asUser('u1'), 'u1', 'lumen-nc2', id, 5, 'Not bought'));
    await assertSucceeds(submitReview(asUser('u1'), 'u1', 'aeris-q40', id, 4, 'Comfortable'));

    const reviewRef = (db: Firestore) => doc(db, 'products', 'aeris-q40', 'reviews', 'u1');
    await assertFails(getDoc(reviewRef(asUser('u2'))));
    await assertFails(updateDoc(reviewRef(asUser('u1')), { status: 'published' }));

    const [pending] = await pendingReviews(asAdmin());
    const before = (await product('aeris-q40')).ratingSummary.count;
    await moderateReview(asAdmin(), pending!, 'published', 'op');
    await assertSucceeds(getDoc(reviewRef(asAnonymous())));
    await assertSucceeds(getDocs(query(collection(asAnonymous(), 'products', 'aeris-q40', 'reviews'), where('status', '==', 'published'))));
    expect((await product('aeris-q40')).ratingSummary.count).toBe(before + 1);
  });
});
