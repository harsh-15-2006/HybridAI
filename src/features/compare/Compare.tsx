import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { compare as comparePrompt, profileLines } from '../../ai/prompts.ts';
import type { CompareResult } from '../../ai/validate.ts';
import { flags } from '../../config/remote.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { setLocal, useLocal } from '../../data/local.ts';
import { Rating, useCartActions } from '../../design/cards.tsx';
import { Icon } from '../../design/icons.tsx';
import { Empty, Loading, ProductImage, usePageTitle } from '../../design/ui.tsx';
import { compareProducts, formatPrice, type CompareRow } from '../../domain/store.ts';
import type { Product } from '../../domain/types.ts';
import { AiResult } from '../assist/AiResult.tsx';

export function ComparePage() {
  usePageTitle('Compare');
  const { products, loading } = useCatalogue();
  const { compare } = useLocal();
  const [params, setParams] = useSearchParams();
  const linked = params.get('ids');

  // A shared link like /compare?ids=a,b loads those products once.
  useEffect(() => {
    if (!linked) return;
    setLocal('compare', linked.split(',').filter(Boolean).slice(0, flags.maxCompareItems));
    setParams({}, { replace: true });
  }, [linked, setParams]);

  if (loading) return <Loading />;
  const chosen = compare.map((id) => products.find((p) => p.id === id)).filter((p) => p !== undefined);
  if (chosen.length < 2) {
    return (
      <Empty title="Choose two or three products to compare">
        <p>{chosen.length === 1 ? `${chosen[0]!.name} is selected. Add one more.` : 'Use the compare button on any product.'}</p>
        <Link className="btn pill" to={chosen[0] ? `/c/${chosen[0].category}` : '/c/audio'}>Browse products</Link>
      </Empty>
    );
  }
  return <Comparison key={chosen.map((p) => p.id).join()} products={chosen} />;
}

function Column({ product, index, rows }: { product: Product; index: number; rows: CompareRow[] }) {
  const { compare } = useLocal();
  const { inCart, disabled, add } = useCartActions(product);
  return (
    <article className="column">
      <button type="button" className="icon-btn bare remove" aria-label={`Remove ${product.name}`}
        onClick={() => setLocal('compare', compare.filter((id) => id !== product.id))}>
        <Icon name="close" size={18} />
      </button>
      <ProductImage product={product} />
      <h2><Link to={`/p/${product.id}`}>{product.name}</Link></h2>
      <Rating product={product} />
      <p className="muted small">{product.type}</p>
      <p className="column-price">Price <strong className="price">{formatPrice(product.priceCents)}</strong></p>
      <button type="button" className="btn wide" disabled={disabled} onClick={add}>
        {product.stock === 0 ? 'Out of stock' : inCart ? `In cart (${inCart})` : 'Add to cart'}
      </button>
      <dl>
        {rows.map((row) => {
          const value = row.values[index];
          const best = row.best.includes(index);
          return (
            <div key={row.key} className={row.differs ? 'differs' : ''}>
              <dt>{row.label}</dt>
              <dd>
                <span className={best ? 'best' : ''}>{value?.value ?? '—'}</span>
                {best && <span className="sr-only"> (best of these)</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
}

function Comparison({ products }: { products: Product[] }) {
  const { profile } = useLocal();
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [notice, setNotice] = useState(true);
  const [usePrefs, setUsePrefs] = useState(false);
  const ai = useAiTask<CompareResult>();
  const hasProfile = profile != null && profileLines(profile).length > 0;
  const rows = compareProducts(products).filter((r) => r.key !== 'price' && (!onlyDifferences || r.differs));
  const mixed = new Set(products.map((p) => p.category)).size > 1;

  return (
    <div className="stack compare-page">
      <h1 className="center-title">Compare products</h1>
      <div className="underline-tabs" role="group" aria-label="Rows to show">
        <button type="button" aria-pressed={!onlyDifferences} onClick={() => setOnlyDifferences(false)}>All specifications</button>
        <button type="button" aria-pressed={onlyDifferences} onClick={() => setOnlyDifferences(true)}>Differences only</button>
      </div>
      {notice && (
        <div className="info-note">
          <p>
            {mixed
              ? 'These are different kinds of product, so many rows have no matching value.'
              : 'An underline marks the better figure where a spec has a clear direction. Comfort and taste are not scored.'}
          </p>
          <button type="button" className="icon-btn bare" aria-label="Close note" onClick={() => setNotice(false)}><Icon name="close" size={16} /></button>
        </div>
      )}
      <div className="columns" style={{ gridTemplateColumns: `repeat(${products.length}, minmax(240px, 1fr))` }}
        tabIndex={0} role="region" aria-label="Comparison">
        {products.map((p, i) => <Column key={p.id} product={p} index={i} rows={rows} />)}
      </div>
      {products.length < flags.maxCompareItems && (
        <p className="center"><Link className="btn secondary pill" to={`/c/${products[0]!.category}`}>Add another product</Link></p>
      )}

      <section className="panel stack tight tinted" aria-labelledby="tradeoffs">
        <h2 id="tradeoffs">Explain the trade-offs</h2>
        {hasProfile && (
          <label className="check">
            <input type="checkbox" checked={usePrefs} onChange={(e) => { setUsePrefs(e.target.checked); ai.reset(); }} />
            Take my preferences into account (this device only)
          </label>
        )}
        <div>
          <button type="button" className="btn pill" disabled={ai.state.phase === 'running'}
            onClick={() => void ai.start(comparePrompt(products, usePrefs ? profile : null))}>
            <Icon name="spark" size={16} /> Explain with AI
          </button>
        </div>
        <AiResult state={ai.state} fallback={<p className="small">The columns above have every fact.</p>}>
          {(d) => (
            <div className="measure stack tight">
              <p>{d.summary}</p>
              <ul className="bullets">{d.tradeoffs.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          )}
        </AiResult>
      </section>
    </div>
  );
}
