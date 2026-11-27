// Deterministic store logic. No AI here: prices, stock, totals, dates and eligibility.
import type { CartLine, Order, OrderStatus, Product, ShippingOption, Spec } from './types.ts';

/** Security Rules check order lines one by one, so the number of lines is capped. */
export const MAX_ORDER_LINES = 5;
export const MAX_QTY = 5;
export const DAY_MS = 86_400_000;

/** Input is in paise. Indian digit grouping, e.g. ₹1,09,999. */
export function formatPrice(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
}

export function addToCart(cart: CartLine[], productId: string, stock: number, qty = 1): CartLine[] {
  const existing = cart.find((l) => l.productId === productId);
  const next = Math.min((existing?.qty ?? 0) + qty, stock, MAX_QTY);
  if (next <= 0) return cart;
  if (existing) return cart.map((l) => (l.productId === productId ? { ...l, qty: next } : l));
  if (cart.length >= MAX_ORDER_LINES) return cart;
  return [...cart, { productId, qty: next }];
}

export function setQty(cart: CartLine[], productId: string, qty: number): CartLine[] {
  if (qty <= 0) return cart.filter((l) => l.productId !== productId);
  return cart.map((l) => (l.productId === productId ? { ...l, qty: Math.min(qty, MAX_QTY) } : l));
}

export function cartSubtotal(cart: CartLine[], products: Product[]): number {
  return cart.reduce((sum, line) => {
    const p = products.find((x) => x.id === line.productId);
    return p ? sum + p.priceCents * line.qty : sum;
  }, 0);
}

export function cartProblems(cart: CartLine[], products: Product[]): string[] {
  const problems: string[] = [];
  for (const line of cart) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) problems.push('An item in your cart is no longer sold.');
    else if (p.stock === 0) problems.push(`${p.name} is out of stock.`);
    else if (line.qty > p.stock) problems.push(`Only ${p.stock} of ${p.name} left.`);
  }
  return problems;
}

export function estimateDelivery(option: ShippingOption, fromMs: number): { fromMs: number; toMs: number } {
  return { fromMs: fromMs + option.minDays * DAY_MS, toMs: fromMs + option.maxDays * DAY_MS };
}

export function estimateText(option: ShippingOption, fromMs: number): string {
  const e = estimateDelivery(option, fromMs);
  return `${formatDate(e.fromMs)} – ${formatDate(e.toMs)}`;
}

export function returnEligibility(
  order: Pick<Order, 'status' | 'deliveredAtMs'>,
  windowDays: number,
  nowMs: number,
  alreadyRequested: boolean,
): { eligible: boolean; reason: string } {
  if (alreadyRequested) return { eligible: false, reason: 'A return has already been requested for this order.' };
  if (order.status !== 'delivered' || order.deliveredAtMs == null) {
    return { eligible: false, reason: 'Returns open once the order is delivered.' };
  }
  const closes = order.deliveredAtMs + windowDays * DAY_MS;
  if (nowMs > closes) return { eligible: false, reason: `The return window closed on ${formatDate(closes)}.` };
  return { eligible: true, reason: `You can request a return until ${formatDate(closes)}.` };
}

export const ORDER_FLOW: OrderStatus[] = ['placed', 'packed', 'shipped', 'delivered'];

export function nextStatuses(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case 'placed':
      return ['packed', 'cancelled'];
    case 'packed':
      return ['shipped'];
    case 'shipped':
      return ['delivered'];
    default:
      return [];
  }
}

// ---- Search -------------------------------------------------------------

export interface SearchFilters {
  text: string;
  category: Product['category'] | null;
  maxPriceCents: number | null;
  inStockOnly: boolean;
}

export const EMPTY_FILTERS: SearchFilters = { text: '', category: null, maxPriceCents: null, inStockOnly: false };

const STOP_WORDS = new Set(
  'a an and are at be for from good i in is it my need of on or that the to want with me some under below over than less up'.split(' '),
);

/** Plain parsing, no AI: pulls a rupee price ceiling and keeps the remaining keywords. */
export function parseQuery(query: string): SearchFilters {
  let text = query.toLowerCase();
  let maxPriceCents: number | null = null;
  const price = text.match(
    /(?:under|below|less than|up to|within|max)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)(\s*k\b)?(?:\s*(?:rupees|rs\b|inr\b))?/,
  );
  if (price) {
    maxPriceCents = Number(price[1]!.replace(/,/g, '')) * (price[2] ? 1000 : 1) * 100;
    text = text.replace(price[0], ' ');
  }
  const words = text.split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  return { text: words.join(' '), category: null, maxPriceCents, inStockOnly: false };
}

/** Everyday words and the catalogue wording that means the same thing. */
const ALSO: Record<string, string[]> = { quiet: ['noise cancelling'], running: ['sweat', 'sport'], gym: ['sweat', 'sport'] };

/** Products matching every hard filter, ranked by how many keywords they mention. */
export function searchProducts(products: Product[], filters: SearchFilters): Product[] {
  const words = filters.text.toLowerCase().split(/\s+/).filter(Boolean);
  // If the words name a kind of product ("headphones", "laptop"), show only that kind.
  const singular = (w: string) => w.replace(/s$/, '');
  const kindOf = (p: Product) => singular(p.type.toLowerCase().split(' ').at(-1)!);
  const alias: Record<string, string> = { mobile: 'phone', smartphone: 'phone', smartwatch: 'watch', screen: 'monitor' };
  const named = (w: string) => alias[singular(w)] ?? singular(w);
  const wanted = new Set(words.map(named).filter((w) => products.some((p) => kindOf(p) === w)));
  const scored = products
    .filter((p) => wanted.size === 0 || wanted.has(kindOf(p)))
    .filter((p) => !filters.category || p.category === filters.category)
    .filter((p) => filters.maxPriceCents == null || p.priceCents <= filters.maxPriceCents)
    .filter((p) => !filters.inStockOnly || p.stock > 0)
    .map((p) => {
      const haystack = [p.name, p.type, p.summary, p.description, p.category, ...p.features, ...p.specs.map((s) => `${s.label} ${s.value}`)]
        .join(' ')
        .toLowerCase();
      const has = (w: string) => haystack.includes(w) || haystack.includes(singular(w));
      const score = words.filter((w) => wanted.has(named(w)) || [w, ...(ALSO[w] ?? [])].some(has)).length;
      return { p, score };
    })
    .filter((x) => words.length === 0 || x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.priceCents - b.p.priceCents);
  return scored.map((x) => x.p);
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const out = [...products];
  if (sort === 'price-asc') out.sort((a, b) => a.priceCents - b.priceCents);
  if (sort === 'price-desc') out.sort((a, b) => b.priceCents - a.priceCents);
  if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ---- Comparison ---------------------------------------------------------

export interface CompareRow {
  key: string;
  label: string;
  values: (Spec | null)[];
  differs: boolean;
  /** Indexes of the best value, only for specs where "better" is defined. */
  best: number[];
}

export function compareProducts(products: Product[]): CompareRow[] {
  const keys: { key: string; label: string }[] = [];
  for (const p of products) {
    for (const s of p.specs) if (!keys.some((k) => k.key === s.key)) keys.push({ key: s.key, label: s.label });
  }
  const priceRow: CompareRow = {
    key: 'price',
    label: 'Price',
    values: products.map((p) => ({ key: 'price', label: 'Price', value: formatPrice(p.priceCents), num: p.priceCents, better: 'lower' })),
    differs: new Set(products.map((p) => p.priceCents)).size > 1,
    best: [],
  };
  const rows: CompareRow[] = [
    priceRow,
    ...keys.map(({ key, label }) => {
      const values = products.map((p) => p.specs.find((s) => s.key === key) ?? null);
      return { key, label, values, differs: new Set(values.map((v) => v?.value ?? '—')).size > 1, best: [] as number[] };
    }),
  ];
  for (const row of rows) {
    const direction = row.values.find((v) => v?.better)?.better;
    if (!direction || !row.differs || row.values.some((v) => v?.num == null)) continue;
    const nums = row.values.map((v) => v!.num!);
    const target = direction === 'higher' ? Math.max(...nums) : Math.min(...nums);
    row.best = nums.flatMap((n, i) => (n === target ? [i] : []));
  }
  return rows;
}
