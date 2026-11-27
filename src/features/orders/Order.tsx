import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { useAiTask } from '../../ai/AiProvider.tsx';
import { MAX_USER_TEXT, orderHelp } from '../../ai/prompts.ts';
import { useOnline } from '../../app/useOnline.ts';
import { useCatalogue } from '../../data/catalogue.tsx';
import { Empty, Loading, Notice, usePageTitle } from '../../design/ui.tsx';
import { estimateText, formatDate, formatPrice, ORDER_FLOW, returnEligibility } from '../../domain/store.ts';
import type { Order, ReturnRequest, Ticket } from '../../domain/types.ts';
import { db } from '../../firebase/app.ts';
import { storeBackendConfigured } from '../../firebase/config.ts';
import { useSession } from '../../store/auth.ts';
import { createTicket, getOrder, getReturn, listTickets, requestReturn } from '../../store/orders.ts';
import { AiResult } from '../assist/AiResult.tsx';
import { STATUS_LABEL } from './Orders.tsx';

interface Data {
  order: Order | null;
  returned: ReturnRequest | null;
  tickets: Ticket[];
}

const RETURN_LABEL = {
  requested: 'Return requested. An operator will decide.',
  approved: 'Return approved.',
  rejected: 'Return declined.',
  refunded_simulated: 'Refund recorded (simulated: no money moves).',
};

export default function OrderPage() {
  const { orderId = '' } = useParams();
  usePageTitle('Order');
  const { ready, user } = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const order = await getOrder(db, orderId);
      const [returned, tickets] = order
        ? await Promise.all([getReturn(db, orderId), listTickets(db, user.uid)])
        : [null, []];
      setData({ order, returned, tickets: tickets.filter((t) => t.orderId === orderId) });
    } catch (error) {
      console.warn('Order could not be read', error);
      setFailed(true);
    }
  }, [user, orderId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const notFound = (
    <Empty title="Order not found">
      <p>Orders are only visible in the browser that placed them.</p>
      <Link to="/orders">My orders</Link>
    </Empty>
  );
  if (!storeBackendConfigured || failed || (ready && !user)) return notFound;
  if (!data) return <Loading label="Loading your order" />;
  if (!data.order) return notFound;
  return <OrderView order={data.order} returned={data.returned} tickets={data.tickets} uid={user!.uid} reload={load} />;
}

function OrderView({ order, returned, tickets, uid, reload }: {
  order: Order;
  returned: ReturnRequest | null;
  tickets: Ticket[];
  uid: string;
  reload: () => Promise<void>;
}) {
  const { store } = useCatalogue();
  const online = useOnline();
  const justPlaced = (useLocation().state as { placed?: boolean } | null)?.placed;
  const [now] = useState(() => Date.now());
  const eligibility = returnEligibility(order, store.returnWindowDays, now, returned != null);
  const cancelled = order.status === 'cancelled';
  const steps = cancelled ? (['placed', 'cancelled'] as const) : ORDER_FLOW;

  return (
    <div className="split">
      <section className="main-col stack">
        <p className="small"><Link to="/orders">My orders</Link></p>
        <h1>Order {order.id.slice(0, 6)}</h1>
        {justPlaced && <Notice tone="good">Order placed. Payment was simulated, so nothing was charged.</Notice>}

        <div className="panel stack">
          <div className="row spread">
            <h2>{STATUS_LABEL[order.status]}</h2>
            <button type="button" className="btn secondary small" onClick={() => void reload()}>Refresh status</button>
          </div>
          {order.status !== 'delivered' && !cancelled && (
            <p className="muted">Estimated delivery {estimateText(order.shipping, order.createdAtMs)}. No courier is connected; an operator updates this.</p>
          )}
          <ol className="timeline">
            {steps.map((step) => {
              const event = order.statusHistory.find((e) => e.status === step);
              return (
                <li key={step} className={event ? 'done' : ''}>
                  <strong>{STATUS_LABEL[step]}</strong>
                  <span className="small muted"> {event ? formatDate(event.atMs) : 'not yet'}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="panel stack tight">
          <h2>Items</h2>
          <dl className="totals">
            {order.items.map((i) => (
              <FragmentRow key={i.productId} label={<Link to={`/p/${i.productId}`}>{i.qty} × {i.name}</Link>} value={formatPrice(i.unitPriceCents * i.qty)} />
            ))}
            <FragmentRow label={order.shipping.label} value={formatPrice(order.shipping.priceCents)} />
            <dt className="grand">Total</dt><dd className="grand">{formatPrice(order.totalCents)}</dd>
          </dl>
          <p className="small muted">
            Deliver to {order.address.name}, {order.address.line1}, {order.address.city} {order.address.postalCode}, {order.address.country}
          </p>
        </div>

        <ReturnSection order={order} uid={uid} returned={returned} eligibility={eligibility} online={online} reload={reload} />
      </section>

      <aside className="side-col panel stack divided">
        <OrderHelp order={order} returned={returned != null} windowDays={store.returnWindowDays} />
        <Support order={order} uid={uid} tickets={tickets} online={online} reload={reload} />
      </aside>
    </div>
  );
}

function FragmentRow({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function OrderHelp({ order, returned, windowDays }: { order: Order; returned: boolean; windowDays: number }) {
  const [question, setQuestion] = useState('');
  const ai = useAiTask();
  const ask = (q: string) => {
    if (q.trim()) void ai.start(orderHelp(order, windowDays, returned, Date.now(), q.trim()));
  };
  return (
    <section className="stack tight">
      <h2>Order help</h2>
      <p className="small muted">Answered on this device only. Your order details are never sent to an AI in the cloud.</p>
      <div className="row">
        {['When will it arrive?', 'Can I return this?'].map((q) => (
          <button type="button" className="btn secondary small" key={q} onClick={() => { setQuestion(q); ask(q); }}>{q}</button>
        ))}
      </div>
      <form className="stack tight" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
        <label className="field">
          Your question
          <input value={question} maxLength={MAX_USER_TEXT} onChange={(e) => setQuestion(e.target.value)} />
        </label>
        <div><button type="submit" className="btn" disabled={!question.trim() || ai.state.phase === 'running'}>Ask on this device</button></div>
      </form>
      <AiResult state={ai.state} fallback={<p className="small">The timeline shows the current status. For anything else, send a message to support below.</p>}>
        {(text) => <p className="streaming">{text}</p>}
      </AiResult>
    </section>
  );
}

function ReturnSection({ order, uid, returned, eligibility, online, reload }: {
  order: Order;
  uid: string;
  returned: ReturnRequest | null;
  eligibility: { eligible: boolean; reason: string };
  online: boolean;
  reload: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await requestReturn(db, uid, order.id, reason);
      await reload();
    } catch {
      setError('The return request was not saved. Try again.');
    }
  };
  return (
    <div className="panel stack tight">
      <h2>Returns</h2>
      {returned ? <Notice>{RETURN_LABEL[returned.status]}</Notice> : <p className="muted">{eligibility.reason}</p>}
      {!returned && eligibility.eligible && (
        <form className="stack tight" onSubmit={submit}>
          <label className="field">
            Why are you returning it?
            <textarea required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div><button type="submit" className="btn" disabled={!reason.trim() || !online}>Request a return</button></div>
          {!online && <p className="small">Reconnect to request a return.</p>}
        </form>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function Support({ order, uid, tickets, online, reload }: {
  order: Order;
  uid: string;
  tickets: Ticket[];
  online: boolean;
  reload: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await createTicket(db, uid, order.id, message);
      setMessage('');
      await reload();
    } catch {
      setError('Your message was not sent. Try again.');
    }
  };
  return (
    <section className="stack tight">
      <h2>Contact support</h2>
      <p className="small muted">A person replies. AI never answers on the store's behalf.</p>
      {tickets.map((t) => (
        <div className="notice stack tight" key={t.id}>
          <p><strong>You:</strong> {t.message}</p>
          {t.replies.map((r) => <p key={r.atMs}><strong>Store:</strong> {r.text}</p>)}
          <p className="small muted">{t.status === 'open' ? 'Waiting for a reply' : t.status === 'answered' ? 'Answered' : 'Closed'}</p>
        </div>
      ))}
      <form className="stack tight" onSubmit={submit}>
        <label className="field">
          Message (use made-up details)
          <textarea required maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <div><button type="submit" className="btn secondary" disabled={!message.trim() || !online}>Send to support</button></div>
        {!online && <p className="small">Reconnect to send a message.</p>}
      </form>
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
