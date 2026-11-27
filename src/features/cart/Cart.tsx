import { Link } from 'react-router';
import { useOnline } from '../../app/useOnline.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { setLocal, useLocal } from '../../data/local.ts';
import { Empty, Loading, Notice, ProductImage, usePageTitle } from '../../design/ui.tsx';
import { cartProblems, cartSubtotal, formatPrice, MAX_QTY, setQty } from '../../domain/store.ts';
import { storeBackendConfigured } from '../../firebase/config.ts';

export function CartPage() {
  usePageTitle('Shopping bag');
  const { cart } = useLocal();
  const { products, loading } = useCatalogue();
  const online = useOnline();

  if (loading) return <Loading />;
  if (!cart.length) {
    return (
      <Empty title="Your cart is empty">
        <Link className="btn pill" to="/">Browse the store</Link>
      </Empty>
    );
  }

  const problems = cartProblems(cart, products);
  const blocked = !online ? 'Reconnect to check out.'
    : !storeBackendConfigured ? 'Ordering needs a Firebase project. See the setup guide.'
    : problems.length ? 'Fix the items above to check out.'
    : null;

  return (
    <div className="bleed bag-page">
      <div className="bag-title"><div className="wrap"><h1>Shopping bag</h1></div></div>
      <div className="wrap">
        {problems.map((p) => <Notice tone="warn" key={p}>{p}</Notice>)}
        <div className="bag-row bag-head" aria-hidden="true">
          <span>Item</span><span>Unit price</span><span>Quantity</span><span>Price</span><span />
        </div>
        {cart.map((line) => {
          const p = products.find((x) => x.id === line.productId);
          const remove = () => setLocal('cart', setQty(cart, line.productId, 0));
          if (!p) {
            return (
              <div className="bag-row" key={line.productId}>
                <span>An item that is no longer sold.</span><span /><span /><span />
                <button type="button" className="link" onClick={remove}>remove</button>
              </div>
            );
          }
          const max = Math.min(MAX_QTY, p.stock);
          return (
            <div className="bag-row" key={p.id}>
              <div className="bag-item">
                <Link to={`/p/${p.id}`} className="bag-thumb" tabIndex={-1} aria-hidden="true"><ProductImage product={p} /></Link>
                <div>
                  <p className="eyebrow">{p.stock <= 4 ? 'Limited stock' : p.type}</p>
                  <Link to={`/p/${p.id}`} className="bag-name">{p.name}</Link>
                </div>
              </div>
              <span className="price" data-label="Unit price">{formatPrice(p.priceCents)}</span>
              <div className="stepper" role="group" aria-label={`Quantity of ${p.name}`}>
                <button type="button" aria-label="One less" disabled={line.qty <= 1} onClick={() => setLocal('cart', setQty(cart, p.id, line.qty - 1))}>−</button>
                <output>{line.qty}</output>
                <button type="button" aria-label="One more" disabled={line.qty >= max} onClick={() => setLocal('cart', setQty(cart, p.id, line.qty + 1))}>+</button>
              </div>
              <span className="price" data-label="Price">{formatPrice(p.priceCents * line.qty)}</span>
              <button type="button" className="link" onClick={remove} aria-label={`Remove ${p.name}`}>remove</button>
            </div>
          );
        })}

        <div className="bag-foot">
          <div className="subtotal">
            <span>Subtotal:</span>
            <strong className="price">{formatPrice(cartSubtotal(cart, products))}</strong>
          </div>
          <p className="small muted">Delivery is chosen at checkout. Payment is simulated.</p>
          <div className="bag-actions">
            <Link to="/" className="back-link"><span aria-hidden="true">⟵</span> Back to shopping</Link>
            {blocked
              ? <button type="button" className="btn square" disabled>Checkout</button>
              : <Link className="btn square" to="/checkout">Checkout</Link>}
          </div>
          {blocked && <p className="small">{blocked}</p>}
        </div>
      </div>
    </div>
  );
}
