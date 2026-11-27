// Category (icon tabs + filter panel + grid) and search (summary + checklist filters + badges).
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { smartSearch } from '../../ai/prompts.ts';
import type { SearchResult } from '../../ai/validate.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { CATEGORIES } from '../../data/seed/catalogue.ts';
import { kindsOf, ProductGrid } from '../../design/cards.tsx';
import { Icon } from '../../design/icons.tsx';
import { Empty, Loading, usePageTitle } from '../../design/ui.tsx';
import { formatPrice, parseQuery, searchProducts, sortProducts, type SearchFilters, type SortKey } from '../../domain/store.ts';
import type { Product } from '../../domain/types.ts';
import { AiResult } from '../assist/AiResult.tsx';
import { factBadges } from './badges.ts';

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const byType = (products: Product[], types: string[]) => (types.length ? products.filter((p) => types.includes(p.type)) : products);

function PriceFields({ filters, setFilters, minCents, setMin }: {
  filters: SearchFilters;
  setFilters: (f: SearchFilters) => void;
  minCents: number | null;
  setMin: (v: number | null) => void;
}) {
  const rupees = (v: number | null) => (v == null ? '' : v / 100);
  const parse = (v: string) => (v ? Math.max(0, Number(v)) * 100 : null);
  return (
    <div className="price-range">
      <label className="field">
        From ₹
        <input type="number" min="0" step="500" inputMode="numeric" value={rupees(minCents)} onChange={(e) => setMin(parse(e.target.value))} />
      </label>
      <label className="field">
        To ₹
        <input type="number" min="0" step="500" inputMode="numeric" value={rupees(filters.maxPriceCents)}
          onChange={(e) => setFilters({ ...filters, maxPriceCents: parse(e.target.value) })} />
      </label>
    </div>
  );
}

function Toolbar({ count, sort, setSort, list, setList }: {
  count: number;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  list: boolean;
  setList: (v: boolean) => void;
}) {
  return (
    <div className="toolbar">
      <p className="muted" role="status">{count} {count === 1 ? 'product' : 'products'}</p>
      <label className="sorter">
        <span className="sr-only">Sort by</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="featured">Best match</option>
          <option value="price-asc">Price, low to high</option>
          <option value="price-desc">Price, high to low</option>
          <option value="name">Name</option>
        </select>
      </label>
      <div className="view-toggle" role="group" aria-label="Layout">
        <button type="button" className="icon-btn" aria-pressed={!list} aria-label="Grid view" onClick={() => setList(false)}><Icon name="grid" size={16} /></button>
        <button type="button" className="icon-btn" aria-pressed={list} aria-label="List view" onClick={() => setList(true)}><Icon name="list" size={16} /></button>
      </div>
    </div>
  );
}

const NoResults = ({ onClear }: { onClear: () => void }) => (
  <Empty title="Nothing matches those filters">
    <button type="button" className="btn secondary" onClick={onClear}>Clear filters</button>
  </Empty>
);

export function CategoryPage() {
  const { category } = useParams();
  const info = CATEGORIES.find((c) => c.id === category);
  usePageTitle(info?.name ?? 'Category');
  return info ? <CategoryView key={info.id} info={info} /> : (
    <Empty title="There is no such category"><Link to="/">Back to the store</Link></Empty>
  );
}

function CategoryView({ info }: { info: (typeof CATEGORIES)[number] }) {
  const { products, loading } = useCatalogue();
  const base: SearchFilters = { text: '', category: info.id, maxPriceCents: null, inStockOnly: false };
  const [filters, setFilters] = useState(base);
  const [min, setMin] = useState<number | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('featured');
  const [list, setList] = useState(false);

  const inCategory = products.filter((p) => p.category === info.id);
  const allTypes = [...new Set(inCategory.map((p) => p.type))];
  const matches = byType(searchProducts(products, filters), types).filter((p) => min == null || p.priceCents >= min);
  // "Best match" keeps catalogue order inside a category.
  const ordered = sort === 'featured' ? products.filter((p) => matches.includes(p)) : sortProducts(matches, sort);
  const clear = () => { setFilters(base); setMin(null); setTypes([]); };

  if (loading) return <Loading />;

  return (
    <div className="stack">
      <div className="tabs" role="group" aria-label="Product type">
        <button type="button" aria-pressed={types.length === 0} onClick={() => setTypes([])}>
          <Icon name="grid" size={34} />
          <span>All</span>
        </button>
        {kindsOf(inCategory).map((k) => (
          <button type="button" key={k.art} aria-pressed={types.includes(k.type)} onClick={() => setTypes(types[0] === k.type && types.length === 1 ? [] : [k.type])}>
            <img src={k.image} alt="" width="800" height="600" />
            <span>{k.label}</span>
          </button>
        ))}
      </div>

      <div className="browse">
        <aside className="filter-col" aria-label="Filters">
          <div className="row spread baseline">
            <h2 className="filter-title">Filter</h2>
            <button type="button" className="link small" onClick={clear}>Clear</button>
          </div>
          <div className="filter-panel">
            <details open>
              <summary>Price</summary>
              <PriceFields filters={filters} setFilters={setFilters} minCents={min} setMin={setMin} />
            </details>
            <details open>
              <summary>Product type</summary>
              {allTypes.map((t) => (
                <label className="check" key={t}>
                  <input type="checkbox" checked={types.includes(t)} onChange={() => setTypes(toggle(types, t))} />
                  {t}
                </label>
              ))}
            </details>
            <details open>
              <summary>Availability</summary>
              <label className="check">
                <input type="checkbox" checked={filters.inStockOnly} onChange={(e) => setFilters({ ...filters, inStockOnly: e.target.checked })} />
                In stock only
              </label>
            </details>
          </div>
        </aside>
        <div className="stack">
          <p className="crumbs"><Link to="/">Home</Link> <span aria-hidden="true">›</span> <span>{info.name}</span></p>
          <div>
            <h1 className="listing-title">{info.name}</h1>
            <p className="muted">{info.blurb}</p>
          </div>
          <Toolbar count={ordered.length} sort={sort} setSort={setSort} list={list} setList={setList} />
          {ordered.length ? <ProductGrid products={ordered} list={list} /> : <NoResults onClear={clear} />}
        </div>
      </div>
    </div>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  usePageTitle(query ? `Search: ${query}` : 'All products');
  return <SearchView key={query} query={query} />;
}

function SearchView({ query }: { query: string }) {
  const { products, loading } = useCatalogue();
  const [filters, setFilters] = useState(() => parseQuery(query));
  const [min, setMin] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>('featured');
  const [list, setList] = useState(false);
  const ai = useAiTask<SearchResult>();
  const results = sortProducts(searchProducts(products, filters), sort).filter((p) => min == null || p.priceCents >= min);
  const words = filters.text.split(' ').filter(Boolean);
  const clear = () => { setFilters({ text: '', category: null, maxPriceCents: null, inStockOnly: false }); setMin(null); };

  const understand = async () => {
    const result = await ai.start(smartSearch(query));
    if (result.status !== 'ok') return;
    const { category, maxPrice, keywords } = result.data;
    setFilters((f) => ({
      ...f,
      category: category === 'any' ? null : category,
      maxPriceCents: maxPrice > 0 ? Math.round(maxPrice * 100) : f.maxPriceCents,
      text: keywords.join(' ').toLowerCase(),
    }));
  };

  if (loading) return <Loading />;

  return (
    <div className="stack">
      <div className="search-head">
        <div>
          <h1 className="listing-title">{query ? 'Search summary' : 'All products'}</h1>
          <p className="muted" role="status">
            Showing {results.length} {results.length === 1 ? 'result' : 'results'}
            {query && <> for <strong>“{query}”</strong></>}
          </p>
        </div>
        {query && (
          <button type="button" className="btn secondary pill" onClick={() => void understand()} disabled={ai.state.phase === 'running'}>
            <Icon name="spark" size={16} /> Understand my words with AI
          </button>
        )}
      </div>
      <AiResult state={ai.state}>{() => <p className="small">Filters updated from your words. Remove any that are wrong.</p>}</AiResult>
      {(filters.category || filters.maxPriceCents != null || words.length > 0) && (
        <div className="row" role="group" aria-label="Filters in use">
          {filters.category && (
            <span className="chip">
              {CATEGORIES.find((c) => c.id === filters.category)?.name}
              <button type="button" aria-label="Remove category filter" onClick={() => setFilters({ ...filters, category: null })}>×</button>
            </span>
          )}
          {filters.maxPriceCents != null && (
            <span className="chip">
              Up to {formatPrice(filters.maxPriceCents)}
              <button type="button" aria-label="Remove price filter" onClick={() => setFilters({ ...filters, maxPriceCents: null })}>×</button>
            </span>
          )}
          {words.map((w) => (
            <span className="chip" key={w}>
              {w}
              <button type="button" aria-label={`Remove keyword ${w}`}
                onClick={() => setFilters({ ...filters, text: words.filter((x) => x !== w).join(' ') })}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="browse">
        <aside className="filter-col" aria-label="Filters">
          <div className="filter-card">
            <details open>
              <summary>Category</summary>
              {CATEGORIES.map((c) => (
                <label className="check" key={c.id}>
                  <input type="checkbox" checked={filters.category === c.id}
                    onChange={() => setFilters({ ...filters, category: filters.category === c.id ? null : c.id })} />
                  {c.name}
                </label>
              ))}
            </details>
            <details open>
              <summary>Price</summary>
              <PriceFields filters={filters} setFilters={setFilters} minCents={min} setMin={setMin} />
            </details>
            <details open>
              <summary>Availability</summary>
              <label className="check">
                <input type="checkbox" checked={filters.inStockOnly} onChange={(e) => setFilters({ ...filters, inStockOnly: e.target.checked })} />
                In stock only
              </label>
            </details>
            <button type="button" className="link small" onClick={clear}>Clear all filters</button>
          </div>
        </aside>
        <div className="stack">
          <Toolbar count={results.length} sort={sort} setSort={setSort} list={list} setList={setList} />
          {results.length ? <ProductGrid products={results} list={list} badges={factBadges(results)} /> : <NoResults onClear={clear} />}
        </div>
      </div>
    </div>
  );
}
