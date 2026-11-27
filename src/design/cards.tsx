// Product presentation shared by home, category and search. Everything shown comes from
// catalogue data: no invented badges, ratings or variants.
import { Link } from 'react-router';
import { flags } from '../config/remote.ts';
import { setLocal, useLocal } from '../data/local.ts';
import { addToCart, formatPrice, MAX_ORDER_LINES, MAX_QTY } from '../domain/store.ts';
import type { Product } from '../domain/types.ts';
import { Icon } from './icons.tsx';
import { hasPhoto, imageFor } from './photos.ts';
import { ProductImage, Stock } from './ui.tsx';

export function Rating({ product }: { product: Product }) {
  const { count, average } = product.ratingSummary;
  if (!count) return <span className="rating muted">No reviews yet</span>;
  return (
    <span className="rating">
      <span className="star" aria-hidden="true">★</span> {average.toFixed(1)}
      <span className="muted"> ({count} demo reviews)</span>
    </span>
  );
}

export function useCartActions(product: Product) {
  const { cart } = useLocal();
  const line = cart.find((l) => l.productId === product.id);
  const full = !line && cart.length >= MAX_ORDER_LINES;
  const maxed = line != null && line.qty >= Math.min(product.stock, MAX_QTY);
  return {
    inCart: line?.qty ?? 0,
    full,
    disabled: product.stock === 0 || full || maxed,
    add: () => setLocal('cart', addToCart(cart, product.id, product.stock)),
  };
}

export function useCompare(product: Product) {
  const { compare } = useLocal();
  const selected = compare.includes(product.id);
  return {
    selected,
    full: !selected && compare.length >= flags.maxCompareItems,
    toggle: () => setLocal('compare', selected ? compare.filter((id) => id !== product.id) : [...compare, product.id]),
  };
}

export function CompareButton({ product }: { product: Product }) {
  const { selected, full, toggle } = useCompare(product);
  return (
    <button type="button" className="icon-btn" aria-pressed={selected} disabled={full} onClick={toggle}
      aria-label={`${selected ? 'Remove from compare' : 'Add to compare'}: ${product.name}`}
      title={full ? `You can compare ${flags.maxCompareItems} at a time` : selected ? 'Remove from compare' : 'Compare'}>
      <Icon name={selected ? 'check' : 'compare'} size={18} />
    </button>
  );
}

export function ProductCard({ product, badge }: { product: Product; badge?: string }) {
  const { inCart, disabled, add } = useCartActions(product);
  return (
    <article className="card">
      <div className="card-media">
        <Link to={`/p/${product.id}`} tabIndex={-1} aria-hidden="true" className={hasPhoto(product) ? 'photo' : ''}>
          <ProductImage product={product} />
        </Link>
        {badge && <span className="fact-badge">{badge}</span>}
      </div>
      <div className="card-body">
        <span className="card-price price">{formatPrice(product.priceCents)}</span>
        <h3>
          <Link to={`/p/${product.id}`}>{product.name}</Link>
        </h3>
        <p className="card-line">{product.type} · {product.specs.slice(0, 2).map((s) => s.value).join(' · ')}</p>
        <div className="row spread card-meta">
          <Rating product={product} />
          <Stock stock={product.stock} />
        </div>
        <div className="card-actions">
          <CompareButton product={product} />
          <button type="button" className="btn small grow" disabled={disabled} onClick={add}>
            <Icon name="cart" size={16} />
            {product.stock === 0 ? 'Out of stock' : inCart ? `In cart (${inCart})` : 'Add to cart'}
            <span className="sr-only"> {product.name}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products, badges, list }: { products: Product[]; badges?: Map<string, string>; list?: boolean }) {
  return (
    <div className={`grid ${list ? 'as-list' : ''}`}>
      {products.map((p) => <ProductCard key={p.id} product={p} badge={badges?.get(p.id)} />)}
    </div>
  );
}

export interface Kind {
  art: string;
  label: string;
  query: string;
  type: string;
  image: string;
}

export function kindsOf(products: Product[]): Kind[] {
  const kinds = new Map<string, Kind>();
  for (const p of products) {
    if (kinds.has(p.art)) continue;
    const noun = p.type.split(' ').at(-1)!.toLowerCase();
    const irregular: Record<string, string> = { mouse: 'mice', bank: 'power banks' };
    const plural = irregular[noun] ?? (noun.endsWith('s') ? noun : /(ch|sh)$/.test(noun) ? `${noun}es` : `${noun}s`);
    kinds.set(p.art, { art: p.art, label: plural, query: noun, type: p.type, image: imageFor(p) });
  }
  return [...kinds.values()];
}

/** Cut-out shortcuts to each kind of product, using the catalogue's own pictures. */
export function KindRow({ products }: { products: Product[] }) {
  return (
    <nav className="kinds" aria-label="Shop by product type">
      {kindsOf(products).map((k) => (
        <Link key={k.art} to={`/search?q=${encodeURIComponent(k.query)}`}>
          <img src={k.image} alt="" width="800" height="600" />
          <span>{k.label}</span>
        </Link>
      ))}
    </nav>
  );
}
