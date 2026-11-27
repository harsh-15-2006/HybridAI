import { useState } from 'react';
import { Link } from 'react-router';
import { useCatalogue } from '../../data/catalogue.tsx';
import { KindRow, ProductGrid } from '../../design/cards.tsx';
import { Icon } from '../../design/icons.tsx';
import { imageAlt, imageFor } from '../../design/photos.ts';
import { Loading, usePageTitle } from '../../design/ui.tsx';
import { formatPrice } from '../../domain/store.ts';
import type { CategoryId, Product } from '../../domain/types.ts';
import { LocalSetup } from '../assist/LocalSetup.tsx';

const SLIDES = [
  { id: 'aeris-q40', title: 'Quiet, comfortable sound', tone: 'sage' },
  { id: 'nova-5-pro', title: 'A brighter screen, a steadier camera', tone: 'stone' },
  { id: 'canvas-27', title: 'More room to think', tone: 'sand' },
  { id: 'breeza-p300', title: 'Cleaner air for the living room', tone: 'mist' },
];
const FEATURED = ['lumen-nc2', 'vela-14', 'tempo-watch', 'pebble-buds', 'nova-5', 'keyline-75', 'breeza-mini', 'slate-tab-11'];

/** Eight kinds fit across one row. */
const HOME_KINDS = ['over-ear', 'earbuds', 'speaker', 'laptop', 'phone', 'watch', 'keyboard', 'monitor'] as const;

const fromPrice = (products: Product[], category: CategoryId) => {
  const prices = products.filter((p) => p.category === category).map((p) => p.priceCents);
  return prices.length ? formatPrice(Math.min(...prices)) : null;
};

function Hero({ products }: { products: Product[] }) {
  const slides = SLIDES.flatMap((s) => {
    const product = products.find((p) => p.id === s.id);
    return product ? [{ ...s, product }] : [];
  });
  const [index, setIndex] = useState(0);
  if (!slides.length) return <section className="hero bleed" aria-hidden="true" />;
  const current = Math.min(index, slides.length - 1);
  const { product, title, tone } = slides[current]!;
  const go = (step: number) => setIndex((current + step + slides.length) % slides.length);

  return (
    <section className="bleed" aria-roledescription="carousel" aria-label="Featured products">
      <div className={`hero ${tone}`}>
        <div className="wrap hero-inner">
          <div className="hero-copy" aria-live="polite">
            <p className="eyebrow">{product.name} · {formatPrice(product.priceCents)}</p>
            <h1>{title}</h1>
            <p>{product.summary}</p>
            <div className="row">
              <Link className="btn pill" to={`/p/${product.id}`}>Show more</Link>
              <Link className="btn ghost pill" to="/about-ai">How private AI works</Link>
            </div>
          </div>
          <Link to={`/p/${product.id}`} className="hero-media" key={product.id}>
            <img src={imageFor(product)} alt={imageAlt(product)} width="800" height="600" />
          </Link>
        </div>
      </div>
      <div className="slider">
        <button type="button" className="icon-btn bare" aria-label="Previous slide" onClick={() => go(-1)}>
          <Icon name="left" size={18} />
        </button>
        <div className="dots">
          {slides.map((s, i) => (
            <button type="button" key={s.id} aria-label={`Show ${s.product.name}`} aria-current={i === current} onClick={() => setIndex(i)} />
          ))}
        </div>
        <button type="button" className="icon-btn bare" aria-label="Next slide" onClick={() => go(1)}>
          <Icon name="right" size={18} />
        </button>
      </div>
    </section>
  );
}

function Promo({ products, category, title, productId }: { products: Product[]; category: CategoryId; title: string; productId: string }) {
  const product = products.find((p) => p.id === productId) ?? products.find((p) => p.category === category);
  const from = fromPrice(products, category);
  return (
    <Link to={`/c/${category}`} className={`promo ${category}`}>
      <div>
        <h2>{title}</h2>
        {from && <p>From {from}</p>}
        <span className="promo-link">Shop now <Icon name="right" size={14} /></span>
      </div>
      {product && <img src={imageFor(product)} alt="" width="800" height="600" />}
    </Link>
  );
}

export function HomePage() {
  usePageTitle('Advice that stays with you');
  const { products, loading } = useCatalogue();
  const featured = FEATURED.map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined).slice(0, 8);

  if (loading) return <Loading label="Loading the catalogue" />;

  return (
    <div className="home stack loose">
      <Hero products={products} />

      <KindRow products={HOME_KINDS.flatMap((art) => products.find((p) => p.art === art) ?? [])} />

      <section className="promos" aria-label="Collections">
        <Promo products={products} category="audio" productId="strata-air-pro" title="Premium headphones" />
        <Promo products={products} category="phones" productId="nova-5-pro" title="Phones, explained" />
        <Promo products={products} category="wearables" productId="tempo-watch" title="On your wrist" />
        <Promo products={products} category="air" productId="breeza-p300" title="Breathe easier" />
      </section>

      <section className="stack">
        <div className="section-head">
          <h2>A good place to start</h2>
          <Link to="/search">View all products</Link>
        </div>
        <ProductGrid products={featured} />
      </section>

      <section className="bleed privacy-band">
        <div className="wrap">
          <h2>Advice that knows you. Details that stay with you.</h2>
          <div className="trio">
            <div>
              <Icon name="laptop" size={28} />
              <h3>On this device</h3>
              <p>Fit checks, order questions and anything using your preferences. Works offline once set up.</p>
            </div>
            <div>
              <Icon name="cloud" size={28} />
              <h3>In the cloud, when you allow it</h3>
              <p>Longer conversations about products. You can see what will be sent. Your preferences are never included.</p>
            </div>
            <div>
              <Icon name="shield" size={28} />
              <h3>Always from the catalogue</h3>
              <p>Prices, stock, specs, delivery dates and order status come from store data, never from AI.</p>
            </div>
          </div>
        </div>
      </section>

      <LocalSetup />
    </div>
  );
}
