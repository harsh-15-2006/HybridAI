// Two steps (shipping, then review and simulated payment); the order page is the confirmation.
// No card or bank details are ever requested.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useOnline } from '../../app/useOnline.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { setLocal, useLocal } from '../../data/local.ts';
import { Icon } from '../../design/icons.tsx';
import { Empty, Loading, Notice, ProductImage, usePageTitle } from '../../design/ui.tsx';
import { cartProblems, cartSubtotal, estimateText, formatPrice } from '../../domain/store.ts';
import { db } from '../../firebase/app.ts';
import { storeBackendConfigured } from '../../firebase/config.ts';
import { ensureShopper } from '../../store/auth.ts';
import { placeOrder, StockError } from '../../store/orders.ts';
import { SimulatedProvider } from '../../store/payment.ts';
import { ADDRESS_FIELDS, addressErrors, EMPTY_ADDRESS, SAMPLE_ADDRESS, trimAddress } from './validate.ts';

const STEPS = ['Shipping', 'Checkout', 'Confirmation'];

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const { cart } = useLocal();
  const { products, shipping, loading, source, reload } = useCatalogue();
  const online = useOnline();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [optionId, setOptionId] = useState('standard');
  const [errors, setErrors] = useState<ReturnType<typeof addressErrors>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  if (loading) return <Loading />;
  if (!cart.length) return <Empty title="Your cart is empty"><Link className="btn pill" to="/">Browse the store</Link></Empty>;
  if (!storeBackendConfigured) {
    return (
      <Empty title="Ordering is not set up">
        <p>No Firebase project is connected, so no order can be saved. See docs/SETUP_AND_DEPLOYMENT.md.</p>
      </Empty>
    );
  }

  const stockProblems = cartProblems(cart, products);
  const subtotal = cartSubtotal(cart, products);
  const option = shipping.options[optionId] ?? Object.values(shipping.options)[0];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = addressErrors(address);
    setErrors(found);
    setProblem(null);
    if (Object.keys(found).length) return setStep(0);
    if (step === 0) return setStep(1);
    setBusy(true);
    try {
      const user = await ensureShopper();
      const orderId = await placeOrder(db, { uid: user.uid, cart, shippingOptionId: optionId, address: trimAddress(address) });
      setLocal('cart', []);
      await reload();
      navigate(`/orders/${orderId}`, { state: { placed: true } });
    } catch (error) {
      console.warn('Order failed', error);
      if (error instanceof StockError) {
        await reload();
        setProblem(`${error.message} Check the quantities in your cart.`);
      } else {
        setProblem('The order was not placed. Check your connection and try again. Nothing was charged.');
      }
      setBusy(false);
    }
  };

  return (
    <form className="checkout" onSubmit={submit} noValidate>
      <section className="checkout-form">
        <h1>Checkout</h1>
        <ol className="steps" aria-label="Checkout progress">
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
              <span aria-hidden="true"><Icon name="check" size={12} /></span>
              {label}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="stack">
            <Notice tone="warn">Demonstration only: use made-up details, not your real address. The address is saved with the order.</Notice>
            <div className="row spread">
              <h2>Delivery address</h2>
              <button type="button" className="btn secondary small pill" onClick={() => { setAddress(SAMPLE_ADDRESS); setErrors({}); }}>
                Use sample address
              </button>
            </div>
            <div className="form-grid">
              {ADDRESS_FIELDS.map((f) => (
                <label className="field caps" key={f.key}>
                  {f.label}
                  <input value={address[f.key]} maxLength={f.max} autoComplete="off" required={f.required}
                    aria-invalid={Boolean(errors[f.key])} aria-describedby={errors[f.key] ? `err-${f.key}` : undefined}
                    onChange={(e) => setAddress({ ...address, [f.key]: e.target.value })} />
                  {errors[f.key] && <span className="field-error" id={`err-${f.key}`}>{errors[f.key]}</span>}
                </label>
              ))}
            </div>
            <fieldset className="stack tight plain">
              <legend>Delivery option</legend>
              {Object.entries(shipping.options).map(([id, o]) => (
                <label className="option" key={id}>
                  <input type="radio" name="shipping" checked={optionId === id} onChange={() => setOptionId(id)} />
                  <span>
                    <strong>{o.label}</strong> · <span className="price">{formatPrice(o.priceCents)}</span>
                    <br />
                    <span className="small muted">Estimated {estimateText(o, now)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className="btn wide">Continue to checkout</button>
            <Link to="/cart" className="back-link center">⟵ Back to cart</Link>
          </div>
        ) : (
          <div className="stack">
            <div className="review-box">
              <h2>Deliver to</h2>
              <p>{address.name}<br />{address.line1}, {address.city} {address.postalCode}<br />{address.country}</p>
              <button type="button" className="link small" onClick={() => setStep(0)}>Change</button>
            </div>
            <div className="review-box">
              <h2>Payment</h2>
              <p><span className="tag">Placeholder</span> {SimulatedProvider.label}.</p>
              <p className="small muted">No card or bank details are requested.</p>
            </div>
            {stockProblems.map((p) => <Notice tone="warn" key={p}>{p}</Notice>)}
            {problem && <Notice tone="error">{problem} <Link to="/cart">Review cart</Link></Notice>}
            {!online && <Notice tone="warn">Reconnect to place the order.</Notice>}
            {source !== 'live' && online && <Notice tone="warn">The live catalogue is unreachable, so orders are paused.</Notice>}
            <button type="submit" className="btn wide" disabled={busy || !online || !option || source !== 'live' || stockProblems.length > 0}>
              {busy ? 'Placing order…' : 'Place order (simulated payment)'}
            </button>
            <button type="button" className="link center" onClick={() => setStep(0)}>⟵ Previous step</button>
          </div>
        )}
      </section>

      <aside className="checkout-summary">
        <h2>Order summary</h2>
        <ul className="summary-items">
          {cart.map((l) => {
            const p = products.find((x) => x.id === l.productId);
            return p && (
              <li key={l.productId}>
                <ProductImage product={p} />
                <div>
                  <p>{p.name}</p>
                  <p className="small muted">{p.type}</p>
                  <p className="small muted">Qty: {l.qty}</p>
                  <p className="price"><strong>{formatPrice(p.priceCents * l.qty)}</strong></p>
                </div>
              </li>
            );
          })}
        </ul>
        <dl className="totals">
          <dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd>
          <dt>Shipping</dt><dd>{option ? formatPrice(option.priceCents) : '—'}</dd>
          <dt className="grand">Order total</dt><dd className="grand">{formatPrice(subtotal + (option?.priceCents ?? 0))}</dd>
        </dl>
      </aside>
    </form>
  );
}
