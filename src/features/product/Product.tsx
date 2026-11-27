import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { flags } from '../../config/remote.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { useLocal } from '../../data/local.ts';
import { CATEGORIES } from '../../data/seed/catalogue.ts';
import { ProductGrid, Rating, useCartActions, useCompare } from '../../design/cards.tsx';
import { Icon, specIcon } from '../../design/icons.tsx';
import { hasPhoto } from '../../design/photos.ts';
import { Empty, Loading, ProductImage, usePageTitle } from '../../design/ui.tsx';
import { formatPrice, MAX_ORDER_LINES } from '../../domain/store.ts';
import type { Product } from '../../domain/types.ts';
import { FitCheck } from './FitCheck.tsx';
import { Reviews } from './Reviews.tsx';
import { SpecList } from './SpecList.tsx';

export function ProductPage() {
  const { productId } = useParams();
  const { products, loading } = useCatalogue();
  const product = products.find((p) => p.id === productId);
  usePageTitle(product?.name ?? 'Product');

  if (loading) return <Loading />;
  if (!product) return <Empty title="We don't sell that product"><Link to="/">Back to the store</Link></Empty>;
  return <ProductView key={product.id} product={product} />;
}

/** Thumbnails: the product picture, then one card per headline spec, drawn from real data. */
function Gallery({ product }: { product: Product }) {
  const cards = product.specs.filter((s) => s.num != null).slice(0, 3);
  const [selected, setSelected] = useState(0);
  const card = selected > 0 ? cards[selected - 1] : undefined;
  return (
    <div className="gallery">
      <div className="thumbs" role="group" aria-label="Product views">
        <button type="button" aria-pressed={selected === 0} aria-label="Product picture" onClick={() => setSelected(0)}>
          <ProductImage product={product} />
        </button>
        {cards.map((s, i) => (
          <button type="button" key={s.key} aria-pressed={selected === i + 1} aria-label={`${s.label}: ${s.value}`} onClick={() => setSelected(i + 1)}>
            <Icon name={specIcon(s.key)} size={24} />
            <small>{s.label}</small>
          </button>
        ))}
      </div>
      <figure>
        <div className={`stage ${hasPhoto(product) ? 'photo' : ''}`}>
          {card ? (
            <div className="stage-spec">
              <Icon name={specIcon(card.key)} size={56} />
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </div>
          ) : (
            <ProductImage product={product} />
          )}
        </div>
        <figcaption className="caption">
          {hasPhoto(product) ? 'Representative photo. The product is fictional.' : 'Illustration of a fictional product.'}
        </figcaption>
      </figure>
    </div>
  );
}

function BuyBox({ product }: { product: Product }) {
  const { shipping, store } = useCatalogue();
  const { inCart, full, disabled, add } = useCartActions(product);
  const compare = useCompare(product);
  const options = Object.values(shipping.options);
  return (
    <section className="buy" aria-label="Buy">
      <p className={`status ${product.stock === 0 ? 'out' : ''}`}>
        {product.stock === 0 ? 'Out of stock' : product.stock <= 4 ? `Only ${product.stock} left` : 'In stock'}
      </p>
      <h1>{product.name}</h1>
      <p className="subtitle">{product.type}</p>
      <Rating product={product} />
      <p className="buy-price price">{formatPrice(product.priceCents)}</p>
      <p>{product.description}</p>
      <button type="button" className="btn pill wide" disabled={disabled} onClick={add}>
        {product.stock === 0 ? 'Out of stock' : 'Add to cart'}
        <Icon name="cart" size={18} />
      </button>
      <button type="button" className="btn secondary pill wide" aria-pressed={compare.selected} disabled={compare.full} onClick={compare.toggle}>
        {compare.selected ? 'Remove from compare' : 'Add to compare'}
      </button>
      {inCart > 0 && <p className="small" role="status">{inCart} in your cart. <Link to="/cart">View cart</Link></p>}
      {compare.selected && <p className="small"><Link to="/compare">Open comparison</Link></p>}
      {full && <p className="small muted">An order can hold {MAX_ORDER_LINES} different products.</p>}
      <ul className="assurances">
        <li>
          <Icon name="truck" size={26} />
          <div>
            <strong>Delivery</strong>
            <span>{options.map((o) => `${o.label.replace(' delivery', '')} ${formatPrice(o.priceCents)}, ${o.minDays}–${o.maxDays} days`).join(' · ')}</span>
          </div>
        </li>
        <li>
          <Icon name="back" size={26} />
          <div>
            <strong>Returns</strong>
            <span>Request a return within {store.returnWindowDays} days of delivery.</span>
          </div>
        </li>
        <li>
          <Icon name="shield" size={26} />
          <div>
            <strong>Private advice</strong>
            <span>Fit checks run on your device. Your preferences are not sent to the cloud.</span>
          </div>
        </li>
      </ul>
    </section>
  );
}

function ProductView({ product }: { product: Product }) {
  const { privacy } = useLocal();
  const { products } = useCatalogue();
  const category = CATEGORIES.find((c) => c.id === product.category)!;
  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="stack loose">
      <div className="stack">
        <nav className="anchors" aria-label="On this page">
          <a href="#overview">Overview</a>
          <a href="#details">Details</a>
          <a href="#for-you">For you</a>
          <a href="#reviews">Reviews</a>
          <Link to={`/compare?ids=${[product.id, related[0]?.id].filter(Boolean).join(',')}`}>Compare</Link>
          {related.length > 0 && <a href="#related">Related</a>}
        </nav>
        <p className="crumbs">
          <Link to="/">Home</Link> <span aria-hidden="true">›</span> <Link to={`/c/${category.id}`}>{category.name}</Link>{' '}
          <span aria-hidden="true">›</span> <span>{product.name}</span>
        </p>
        <div id="overview" className="product-top">
          <Gallery product={product} />
          <BuyBox product={product} />
        </div>
      </div>

      <section className="highlights" aria-label="Highlights">
        {product.specs.slice(0, 4).map((s) => (
          <div key={s.key}>
            <Icon name={specIcon(s.key)} size={30} />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </section>

      <div id="details" className="split">
        <div className="main-col stack">
          <SpecList product={product} />
          <h3>In the design</h3>
          <ul className="feature-list">
            {product.features.map((f) => <li key={f}><Icon name="check" size={18} />{f}</li>)}
          </ul>
        </div>

        <aside id="for-you" className="side-col for-you stack divided" aria-label="For you">
          <h2>For you</h2>
          <FitCheck product={product} />
          {flags.askAnythingEnabled && privacy !== 'device' && (
            <section className="stack tight">
              <h3>Still deciding?</h3>
              <p className="muted small">Ask a longer question in a conversation. This uses Gemini in the cloud, and nothing personal saved on this device is attached.</p>
              <div>
                <Link className="btn cloud pill" to={`/p/${product.id}/ask`}><Icon name="cloud" size={16} /> Ask about this product</Link>
              </div>
            </section>
          )}
        </aside>
      </div>

      <div id="reviews">
        <Reviews product={product} />
      </div>

      {related.length > 0 && (
        <section id="related" className="stack">
          <h2>More in {category.name.toLowerCase()}</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
