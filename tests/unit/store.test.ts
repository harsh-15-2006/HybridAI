import { describe, expect, it } from 'vitest';
import { PRODUCTS, SHIPPING_CONFIG } from '../../src/data/seed/catalogue.ts';
import {
  addToCart, cartProblems, cartSubtotal, compareProducts, DAY_MS, estimateDelivery, MAX_ORDER_LINES, nextStatuses,
  parseQuery, returnEligibility, searchProducts, setQty,
} from '../../src/domain/store.ts';
import { addressErrors, EMPTY_ADDRESS, SAMPLE_ADDRESS } from '../../src/features/checkout/validate.ts';

const byId = (id: string) => PRODUCTS.find((p) => p.id === id)!;

describe('cart', () => {
  it('adds, caps at stock and quantity, and limits distinct lines', () => {
    let cart = addToCart([], 'a', 2);
    cart = addToCart(cart, 'a', 2);
    cart = addToCart(cart, 'a', 2);
    expect(cart).toEqual([{ productId: 'a', qty: 2 }]);
    expect(addToCart([], 'b', 0)).toEqual([]);
    let full = cart;
    for (const id of ['b', 'c', 'd', 'e', 'f']) full = addToCart(full, id, 5);
    expect(full).toHaveLength(MAX_ORDER_LINES);
    expect(setQty(cart, 'a', 0)).toEqual([]);
  });

  it('totals from catalogue prices and reports stock problems', () => {
    const cart = [{ productId: 'aeris-q40', qty: 2 }, { productId: 'hearth-one', qty: 1 }];
    expect(cartSubtotal(cart, PRODUCTS)).toBe(1_199_900 * 2 + 699_900);
    expect(cartProblems(cart, PRODUCTS)).toEqual(['Hearth One is out of stock.']);
  });
});

describe('search', () => {
  it('reads a price ceiling and keywords without AI', () => {
    const f = parseQuery('quiet headphones for long flights, under ₹10,000');
    expect(f.maxPriceCents).toBe(1_000_000);
    expect(f.text.split(' ')).toContain('headphones');
    const results = searchProducts(PRODUCTS, f);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.priceCents <= 1_000_000)).toBe(true);
    expect(results[0]!.type).toBe('Over-ear headphones');
  });

  it('understands the ways people write rupee limits', () => {
    for (const q of ['under ₹10,000', 'below Rs. 10000', 'within 10k', 'up to INR 10,000', 'under 10000 rupees']) {
      expect(parseQuery(`headphones ${q}`)).toMatchObject({ maxPriceCents: 1_000_000, text: 'headphones' });
    }
    expect(parseQuery('laptop under ₹1,00,000').maxPriceCents).toBe(10_000_000);
    const results = searchProducts(PRODUCTS, parseQuery('Quiet headphones for travelling under ₹10,000'));
    expect(results.map((p) => p.id)).toContain('lumen-nc2');
  });

  it('applies category and stock filters', () => {
    const results = searchProducts(PRODUCTS, { text: '', category: 'audio', maxPriceCents: null, inStockOnly: true });
    expect(results.every((p) => p.category === 'audio' && p.stock > 0)).toBe(true);
  });
});

describe('comparison', () => {
  it('marks differences and the better figure from real specs', () => {
    const rows = compareProducts([byId('aeris-q40'), byId('lumen-nc2')]);
    expect(rows.find((r) => r.key === 'battery')).toMatchObject({ differs: true, best: [0] });
    expect(rows.find((r) => r.key === 'weight')!.best).toEqual([1]);
    expect(rows.find((r) => r.key === 'price')!.best).toEqual([1]);
    expect(rows.find((r) => r.key === 'pads')!.best).toEqual([]);
  });
});

describe('orders', () => {
  it('estimates delivery from the option', () => {
    expect(estimateDelivery(SHIPPING_CONFIG.options.express!, 0)).toEqual({ fromMs: DAY_MS, toMs: 2 * DAY_MS });
  });

  it('opens returns only after delivery and inside the window', () => {
    expect(returnEligibility({ status: 'shipped', deliveredAtMs: null }, 14, 0, false).eligible).toBe(false);
    expect(returnEligibility({ status: 'delivered', deliveredAtMs: 0 }, 14, 13 * DAY_MS, false).eligible).toBe(true);
    expect(returnEligibility({ status: 'delivered', deliveredAtMs: 0 }, 14, 15 * DAY_MS, false).eligible).toBe(false);
    expect(returnEligibility({ status: 'delivered', deliveredAtMs: 0 }, 14, 0, true).eligible).toBe(false);
  });

  it('follows the order lifecycle', () => {
    expect(nextStatuses('placed')).toEqual(['packed', 'cancelled']);
    expect(nextStatuses('delivered')).toEqual([]);
  });

  it('validates the checkout address', () => {
    expect(addressErrors(SAMPLE_ADDRESS)).toEqual({});
    expect(Object.keys(addressErrors(EMPTY_ADDRESS)).sort()).toEqual(['city', 'country', 'line1', 'name', 'postalCode']);
  });
});

describe('catalogue data', () => {
  it('is labelled sample data with unique ids and whole-cent prices', () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    for (const p of PRODUCTS) {
      expect(p.sample).toBe(true);
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.specs.length).toBeGreaterThan(0);
    }
  });
});
