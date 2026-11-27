import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAi } from '../ai/AiProvider.tsx';
import { useCatalogue } from '../data/catalogue.tsx';
import { useLocal } from '../data/local.ts';
import { CATEGORIES } from '../data/seed/catalogue.ts';
import { Icon, type IconName } from '../design/icons.tsx';
import { SearchForm } from '../features/catalogue/SearchForm.tsx';
import { backendMode } from '../firebase/config.ts';
import { useSession } from '../store/auth.ts';
import { useOnline } from './useOnline.ts';

function AiChip() {
  const { status, progress } = useAi();
  const label =
    status === 'available' ? 'Private AI ready on this device'
    : status === 'downloadable' ? 'Set up private AI'
    : status === 'downloading' ? `Downloading private AI${progress != null ? ` ${Math.round(progress * 100)}%` : ''}`
    : status === 'checking' ? 'Checking private AI'
    : 'Private AI not available here';
  return (
    <Link to="/you" className={`ai-chip ${status === 'available' ? 'ready' : ''}`}>
      <i aria-hidden="true" />
      {label}
    </Link>
  );
}

function Tool({ to, icon, label, badge }: { to: string; icon: IconName; label: string; badge?: number }) {
  return (
    <NavLink to={to} className="tool" aria-label={badge != null ? `${label} (${badge})` : label} title={label}>
      <Icon name={icon} size={22} />
      {badge != null && badge > 0 && <span className="badge" aria-hidden="true">{badge}</span>}
    </NavLink>
  );
}

export function Layout() {
  const { cart, compare } = useLocal();
  const { source, loading } = useCatalogue();
  const { isAdmin } = useSession();
  const online = useOnline();
  const { pathname, search } = useLocation();
  const count = cart.reduce((n, l) => n + l.qty, 0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <p className="topbar">Private by design: personal checks run on your device. Demonstration store, payment is simulated.</p>
      <header className="header">
        <div className="wrap header-top">
          <Link to="/" className="brand">
            <img src="/brand/logo.png" alt="" />
            HybridCart
          </Link>
          <div className="header-search">
            <SearchForm key={search} initial={new URLSearchParams(search).get('q') ?? ''} compact />
          </div>
          <div className="tools">
            <Tool to="/compare" icon="compare" label="Compare" badge={compare.length} />
            <Tool to="/orders" icon="box" label="Orders" />
            <Tool to="/you" icon="user" label="You" />
            <Tool to="/cart" icon="cart" label="Cart" badge={count} />
          </div>
        </div>
        <div className="wrap header-sub">
          <nav className="nav" aria-label="Categories">
            {CATEGORIES.map((c) => (
              <NavLink key={c.id} to={`/c/${c.id}`}>{c.name}</NavLink>
            ))}
          </nav>
          <AiChip />
        </div>
      </header>

      {!online && (
        <div className="banner" role="status">
          <div className="wrap">
            You are offline. Browsing and your cart still work, and on-device AI works if it is set up. Checkout, returns and support need a connection.
          </div>
        </div>
      )}
      {!loading && source !== 'live' && online && (
        <div className="banner" role="status">
          <div className="wrap">
            {backendMode === 'unconfigured'
              ? 'Setup needed: no Firebase project is connected. You are browsing the bundled demonstration catalogue; ordering and cloud AI are off.'
              : source === 'cached'
                ? 'The live catalogue could not be reached. Showing the copy saved on this device; prices and stock may be out of date.'
                : 'The live catalogue could not be reached. Showing the bundled demonstration catalogue.'}
          </div>
        </div>
      )}

      <main id="content" className="wrap" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <p className="brand small-brand"><img src="/brand/logo.png" alt="" />HybridCart</p>
            <p>Advice that knows you, without your details leaving your device.</p>
          </div>
          <nav aria-label="Shop">
            <strong>Shop</strong>
            {CATEGORIES.map((c) => <Link key={c.id} to={`/c/${c.id}`}>{c.name}</Link>)}
          </nav>
          <nav aria-label="Help">
            <strong>Help</strong>
            <Link to="/help">Delivery, returns and payment</Link>
            <Link to="/about-ai">How HybridCart uses AI</Link>
            <Link to="/ledger">AI activity</Link>
            {isAdmin && <Link to="/admin">Operator area</Link>}
          </nav>
          <p className="legal">A demonstration store. Brands, products and sample reviews are fictional, pictures are illustrations or representative photos, and no money is taken.</p>
        </div>
      </footer>
    </>
  );
}
