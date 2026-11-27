// Operator area. This UI only hides controls; Security Rules enforce the admin claim.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { reviewScreen } from '../../ai/prompts.ts';
import type { ScreenResult } from '../../ai/validate.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { Empty, Loading, Notice, usePageTitle } from '../../design/ui.tsx';
import { formatDate, formatPrice, nextStatuses } from '../../domain/store.ts';
import type { Order, Product, ReturnRequest, ReturnStatus, Review, Ticket } from '../../domain/types.ts';
import { db } from '../../firebase/app.ts';
import { storeBackendConfigured } from '../../firebase/config.ts';
import { signInOperator, signOutUser, useSession } from '../../store/auth.ts';
import {
  decideReturn, listOrders, listReturns, listTickets, moderateReview, pendingReviews, replyToTicket, setOrderStatus, setStock,
} from '../../store/orders.ts';
import { AiResult } from '../assist/AiResult.tsx';
import { STATUS_LABEL } from '../orders/Orders.tsx';

export default function AdminPage() {
  usePageTitle('Operator area');
  const { ready, user, isAdmin } = useSession();

  if (!storeBackendConfigured) {
    return <Empty title="Not set up"><p>The operator area needs a Firebase project. See docs/ADMIN_SETUP.md.</p></Empty>;
  }
  if (!ready) return <Loading />;
  if (!isAdmin) return <SignIn signedInWithoutClaim={user != null && !user.isAnonymous} />;
  return <Console uid={user!.uid} />;
}

function SignIn({ signedInWithoutClaim }: { signedInWithoutClaim: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await signInOperator(email, password);
    } catch {
      setError('Sign-in failed. Check the email and password.');
    }
  };
  return (
    <form className="panel stack" style={{ maxWidth: 420 }} onSubmit={submit}>
      <h1>Operator sign-in</h1>
      {signedInWithoutClaim && (
        <Notice tone="error">
          This account is not an operator. Access is granted with a custom claim from a trusted machine, never from the browser.{' '}
          <button type="button" className="link" onClick={() => void signOutUser()}>Sign out</button>
        </Notice>
      )}
      <p className="small muted">Signing in here replaces the guest shopper session in this browser.</p>
      <label className="field">Email<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field">Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button type="submit" className="btn">Sign in</button>
      {error && <Notice tone="error">{error}</Notice>}
    </form>
  );
}

const TABS = ['Orders', 'Stock', 'Returns', 'Support', 'Reviews'] as const;
type Tab = (typeof TABS)[number];

interface Queues {
  orders: Order[];
  returns: ReturnRequest[];
  tickets: Ticket[];
  reviews: Review[];
}

function Console({ uid }: { uid: string }) {
  const { products, reload } = useCatalogue();
  const [tab, setTab] = useState<Tab>('Orders');
  const [queues, setQueues] = useState<Queues | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [orders, returns, tickets, reviews] = await Promise.all([listOrders(db), listReturns(db), listTickets(db), pendingReviews(db)]);
      setQueues({ orders, returns, tickets, reviews });
      await reload();
    } catch (e) {
      console.warn(e);
      setError('The queues could not be loaded.');
    }
  }, [reload]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  /** Runs a write, reports a failure, then reloads. */
  const act = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
    } catch (e) {
      console.warn(e);
      setError('That change was not saved.');
    }
    await refresh();
  };

  return (
    <div className="stack">
      <div className="row spread">
        <h1>Operator area</h1>
        <button type="button" className="btn secondary small" onClick={() => void signOutUser()}>Sign out</button>
      </div>
      <div className="row" role="group" aria-label="Sections">
        {TABS.map((t) => (
          <button type="button" key={t} className={`btn small ${t === tab ? '' : 'secondary'}`} aria-pressed={t === tab} onClick={() => setTab(t)}>{t}</button>
        ))}
        <button type="button" className="link" onClick={() => void refresh()}>Refresh</button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!queues ? <Loading /> : (
        <>
          {tab === 'Orders' && <OrdersQueue orders={queues.orders} act={act} />}
          {tab === 'Stock' && <StockQueue products={products} act={act} />}
          {tab === 'Returns' && <ReturnsQueue returns={queues.returns} act={act} />}
          {tab === 'Support' && <SupportQueue tickets={queues.tickets} act={act} />}
          {tab === 'Reviews' && <ReviewsQueue reviews={queues.reviews} products={products} uid={uid} act={act} />}
        </>
      )}
    </div>
  );
}

type Act = (task: () => Promise<unknown>) => Promise<void>;

function OrdersQueue({ orders, act }: { orders: Order[]; act: Act }) {
  if (!orders.length) return <p className="muted">No orders yet.</p>;
  return (
    <div className="stack tight">
      {orders.map((o) => (
        <div className="line" key={o.id}>
          <div className="grow">
            <p><strong>Order {o.id.slice(0, 6)}</strong> · {formatDate(o.createdAtMs)} · {formatPrice(o.totalCents)}</p>
            <p className="small muted">{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</p>
          </div>
          <span className="tag">{STATUS_LABEL[o.status]}</span>
          {nextStatuses(o.status).map((s) => (
            <button type="button" key={s} className={`btn small ${s === 'cancelled' ? 'danger' : ''}`}
              onClick={() => void act(() => setOrderStatus(db, o.id, s))}>
              {s === 'cancelled' ? 'Cancel and restock' : `Mark ${STATUS_LABEL[s].toLowerCase()}`}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function StockQueue({ products, act }: { products: Product[]; act: Act }) {
  return (
    <div className="stack tight">
      {products.map((p) => <StockRow key={`${p.id}-${p.stock}`} product={p} act={act} />)}
    </div>
  );
}

function StockRow({ product, act }: { product: Product; act: Act }) {
  const [value, setValue] = useState(String(product.stock));
  const stock = Number(value);
  const valid = value !== '' && Number.isInteger(stock) && stock >= 0;
  return (
    <form className="line" onSubmit={(e) => { e.preventDefault(); if (valid) void act(() => setStock(db, product.id, stock)); }}>
      <p className="grow">{product.name} <span className="small muted">now {product.stock}</span></p>
      <label>
        <span className="sr-only">New stock for {product.name}</span>
        <input type="number" min="0" step="1" value={value} style={{ width: 110 }} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="submit" className="btn small" disabled={!valid || stock === product.stock}>Save</button>
    </form>
  );
}

const RETURN_ACTIONS: Partial<Record<ReturnStatus, [ReturnStatus, string][]>> = {
  requested: [['approved', 'Approve'], ['rejected', 'Decline']],
  approved: [['refunded_simulated', 'Record simulated refund']],
};

function ReturnsQueue({ returns, act }: { returns: ReturnRequest[]; act: Act }) {
  if (!returns.length) return <p className="muted">No return requests.</p>;
  return (
    <div className="stack tight">
      {returns.map((r) => (
        <div className="line" key={r.id}>
          <div className="grow">
            <p><strong>Order {r.orderId.slice(0, 6)}</strong> · {formatDate(r.createdAtMs)}</p>
            <p className="small">{r.reason}</p>
          </div>
          <span className="tag">{r.status.replace('_', ' ')}</span>
          {RETURN_ACTIONS[r.status]?.map(([status, label]) => (
            <button type="button" className="btn small" key={status} onClick={() => void act(() => decideReturn(db, r.id, status))}>{label}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

function SupportQueue({ tickets, act }: { tickets: Ticket[]; act: Act }) {
  if (!tickets.length) return <p className="muted">No support messages.</p>;
  return (
    <div className="stack tight">
      {tickets.map((t) => <TicketRow key={t.id} ticket={t} act={act} />)}
    </div>
  );
}

function TicketRow({ ticket, act }: { ticket: Ticket; act: Act }) {
  const [text, setText] = useState('');
  return (
    <form className="panel stack tight" onSubmit={(e) => { e.preventDefault(); void act(() => replyToTicket(db, ticket, text)); setText(''); }}>
      <p>
        <strong>{ticket.orderId ? `Order ${ticket.orderId.slice(0, 6)}` : 'General'}</strong> · {formatDate(ticket.createdAtMs)}{' '}
        <span className="tag">{ticket.status}</span>
      </p>
      <p>{ticket.message}</p>
      {ticket.replies.map((r) => <p className="notice" key={r.atMs}>{r.text}</p>)}
      <label className="field">Reply<textarea maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div><button type="submit" className="btn small" disabled={!text.trim()}>Send reply</button></div>
    </form>
  );
}

function ReviewsQueue({ reviews, products, uid, act }: { reviews: Review[]; products: Product[]; uid: string; act: Act }) {
  if (!reviews.length) return <p className="muted">No reviews waiting.</p>;
  return (
    <div className="stack tight">
      {reviews.map((r) => (
        <ReviewRow key={`${r.productId}-${r.id}`} review={r} uid={uid} act={act}
          productName={products.find((p) => p.id === r.productId)?.name ?? r.productId} />
      ))}
    </div>
  );
}

function ReviewRow({ review, productName, uid, act }: { review: Review; productName: string; uid: string; act: Act }) {
  const ai = useAiTask<ScreenResult>();
  return (
    <div className="panel stack tight">
      <p><strong>{productName}</strong> · {review.rating} of 5 · {formatDate(review.createdAtMs)}</p>
      <p>{review.text}</p>
      <div>
        <button type="button" className="btn secondary small" onClick={() => void ai.start(reviewScreen(review.text, productName))}>
          Get an AI suggestion
        </button>
      </div>
      <AiResult state={ai.state}>
        {(d) => <p>Suggestion: <strong>{d.suggestion === 'publish_ok' ? 'Fine to publish' : 'Needs a closer look'}</strong>. {d.reason} You decide.</p>}
      </AiResult>
      <div className="row">
        <button type="button" className="btn small" onClick={() => void act(() => moderateReview(db, review, 'published', uid))}>Publish</button>
        <button type="button" className="btn danger small" onClick={() => void act(() => moderateReview(db, review, 'rejected', uid))}>Reject</button>
      </div>
    </div>
  );
}
