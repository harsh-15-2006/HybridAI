// Order, stock and post-purchase writes. Every function takes the Firestore instance so the
// same code runs against the emulator in tests.
import {
  addDoc, collection, collectionGroup, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where,
  type Firestore,
} from 'firebase/firestore';
import { cartSubtotal, MAX_ORDER_LINES, nextStatuses } from '../domain/store.ts';
import type {
  Address, CartLine, Order, OrderStatus, Product, ReturnRequest, ReturnStatus, Review, ShippingConfig, StatusEvent, Ticket,
} from '../domain/types.ts';
import { SimulatedProvider, type PaymentProvider } from './payment.ts';

export class StockError extends Error {
  readonly productIds: string[];
  constructor(message: string, productIds: string[]) {
    super(message);
    this.productIds = productIds;
  }
}

export interface PlaceOrderInput {
  uid: string;
  cart: CartLine[];
  shippingOptionId: string;
  address: Address;
}

export async function placeOrder(
  db: Firestore,
  input: PlaceOrderInput,
  payment: PaymentProvider = SimulatedProvider,
  now: () => number = Date.now,
): Promise<string> {
  const { uid, cart, shippingOptionId, address } = input;
  if (cart.length === 0 || cart.length > MAX_ORDER_LINES) throw new Error(`An order needs 1 to ${MAX_ORDER_LINES} different products.`);

  // Payment happens outside the transaction: Firestore may retry the transaction body.
  const paid = await payment.authorise();
  const orderRef = doc(collection(db, 'orders'));

  await runTransaction(db, async (tx) => {
    const shippingSnap = await tx.get(doc(db, 'config', 'shipping'));
    const option = (shippingSnap.data() as ShippingConfig | undefined)?.options[shippingOptionId];
    if (!option) throw new Error('That delivery option is no longer offered.');

    const snaps = await Promise.all(cart.map((line) => tx.get(doc(db, 'products', line.productId))));
    const products = snaps.map((s) => (s.exists() ? ({ ...s.data(), id: s.id } as Product) : null));
    const short = cart.filter((line, i) => !products[i] || products[i]!.stock < line.qty);
    if (short.length) {
      throw new StockError('Stock changed while you were checking out.', short.map((l) => l.productId));
    }
    const found = products as Product[];

    const items = cart.map((line, i) => ({
      productId: line.productId,
      name: found[i]!.name,
      qty: line.qty,
      unitPriceCents: found[i]!.priceCents,
    }));
    const subtotalCents = cartSubtotal(cart, found);
    const at = now();
    const order: Omit<Order, 'id'> = {
      uid,
      items,
      quantities: Object.fromEntries(cart.map((l) => [l.productId, l.qty])),
      subtotalCents,
      shipping: { optionId: shippingOptionId, priceCents: option.priceCents, label: option.label, minDays: option.minDays, maxDays: option.maxDays },
      totalCents: subtotalCents + option.priceCents,
      address,
      payment: paid,
      status: 'placed',
      statusHistory: [{ status: 'placed', atMs: at, by: 'shopper' }],
      createdAtMs: at,
      deliveredAtMs: null,
    };

    cart.forEach((line, i) => {
      tx.update(doc(db, 'products', line.productId), { stock: found[i]!.stock - line.qty, lastOrderId: orderRef.id });
    });
    tx.set(orderRef, order);
  });

  return orderRef.id;
}

const byNewest = <T extends { createdAtMs: number }>(list: T[]) => list.sort((a, b) => b.createdAtMs - a.createdAtMs);

async function list<T extends { createdAtMs: number }>(db: Firestore, name: string, uid?: string): Promise<T[]> {
  const col = collection(db, name);
  const snap = await getDocs(uid ? query(col, where('uid', '==', uid)) : col);
  return byNewest(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as unknown as T));
}

/** Pass a uid for a shopper's own records; operators omit it. */
export const listOrders = (db: Firestore, uid?: string) => list<Order>(db, 'orders', uid);
export const listReturns = (db: Firestore, uid?: string) => list<ReturnRequest>(db, 'returns', uid);
export const listTickets = (db: Firestore, uid?: string) => list<Ticket>(db, 'supportTickets', uid);

export async function getOrder(db: Firestore, id: string): Promise<Order | null> {
  const snap = await getDoc(doc(db, 'orders', id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Order) : null;
}

export async function getReturn(db: Firestore, orderId: string): Promise<ReturnRequest | null> {
  const snap = await getDoc(doc(db, 'returns', orderId));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as ReturnRequest) : null;
}

export async function requestReturn(db: Firestore, uid: string, orderId: string, reason: string) {
  await setDoc(doc(db, 'returns', orderId), { orderId, uid, reason: reason.trim(), status: 'requested', createdAtMs: Date.now() });
}

export async function createTicket(db: Firestore, uid: string, orderId: string | null, message: string) {
  await addDoc(collection(db, 'supportTickets'), {
    uid, orderId, message: message.trim(), replies: [], status: 'open', createdAtMs: Date.now(),
  });
}

export async function submitReview(
  db: Firestore, uid: string, productId: string, orderId: string, rating: number, text: string,
) {
  await setDoc(doc(db, 'products', productId, 'reviews', uid), {
    uid, productId, orderId, rating, text: text.trim(), status: 'pending',
    aiSuggestion: null, aiReason: null, moderatedBy: null, sample: false, createdAtMs: Date.now(),
  });
}

export async function publishedReviews(db: Firestore, productId: string): Promise<Review[]> {
  const snap = await getDocs(query(collection(db, 'products', productId, 'reviews'), where('status', '==', 'published')));
  // Offline, Firestore answers from an empty cache. Report that instead of "no reviews".
  if (snap.empty && snap.metadata.fromCache) throw new Error('Reviews are unreachable.');
  return byNewest(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Review));
}

// ---- Operator actions (Security Rules require the admin claim) ------------

export async function setOrderStatus(db: Firestore, orderId: string, status: OrderStatus, now: () => number = Date.now) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'orders', orderId);
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order || !nextStatuses(order.status).includes(status)) throw new Error('That status change is not allowed.');

    // Reads must come before writes. Cancelling returns the units to stock.
    const restock =
      status === 'cancelled'
        ? await Promise.all(order.items.map(async (item) => {
            const productRef = doc(db, 'products', item.productId);
            return { ref: productRef, snap: await tx.get(productRef), qty: item.qty };
          }))
        : [];

    const event: StatusEvent = { status, atMs: now(), by: 'operator' };
    tx.update(ref, {
      status,
      statusHistory: [...order.statusHistory, event],
      deliveredAtMs: status === 'delivered' ? event.atMs : order.deliveredAtMs,
    });
    for (const r of restock) {
      if (r.snap.exists()) tx.update(r.ref, { stock: (r.snap.data() as Product).stock + r.qty });
    }
  });
}

export async function setStock(db: Firestore, productId: string, stock: number) {
  if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number of 0 or more.');
  await updateDoc(doc(db, 'products', productId), { stock });
}

export async function decideReturn(db: Firestore, orderId: string, status: ReturnStatus) {
  await updateDoc(doc(db, 'returns', orderId), { status });
}

export async function replyToTicket(db: Firestore, ticket: Ticket, text: string) {
  await updateDoc(doc(db, 'supportTickets', ticket.id), {
    replies: [...ticket.replies, { by: 'operator', text: text.trim(), atMs: Date.now() }],
    status: 'answered',
  });
}

export async function pendingReviews(db: Firestore): Promise<Review[]> {
  const snap = await getDocs(query(collectionGroup(db, 'reviews'), where('status', '==', 'pending')));
  return byNewest(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Review));
}

export async function moderateReview(db: Firestore, review: Review, status: 'published' | 'rejected', moderator: string) {
  await runTransaction(db, async (tx) => {
    const reviewRef = doc(db, 'products', review.productId, 'reviews', review.id);
    const productRef = doc(db, 'products', review.productId);
    const [current, product] = [await tx.get(reviewRef), await tx.get(productRef)];
    if ((current.data() as Review | undefined)?.status !== 'pending') throw new Error('This review was already decided.');
    tx.update(reviewRef, { status, moderatedBy: moderator });
    if (status === 'published' && product.exists()) {
      const { count, average } = (product.data() as Product).ratingSummary;
      const next = Math.round(((average * count + review.rating) / (count + 1)) * 10) / 10;
      tx.update(productRef, { ratingSummary: { count: count + 1, average: next } });
    }
  });
}
