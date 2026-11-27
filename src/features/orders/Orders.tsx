import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Empty, Loading, Notice, usePageTitle } from '../../design/ui.tsx';
import { formatDate, formatPrice } from '../../domain/store.ts';
import type { Order } from '../../domain/types.ts';
import { db } from '../../firebase/app.ts';
import { storeBackendConfigured } from '../../firebase/config.ts';
import { useSession } from '../../store/auth.ts';
import { listOrders } from '../../store/orders.ts';

export const STATUS_LABEL = {
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrdersPage() {
  usePageTitle('My orders');
  const { ready, user } = useSession();
  const [loaded, setLoaded] = useState<{ uid: string; orders: Order[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    listOrders(db, user.uid)
      .then((orders) => setLoaded({ uid: user.uid, orders }))
      .catch(() => setFailed(true));
  }, [user]);

  if (!storeBackendConfigured) {
    return <Empty title="Orders are not set up"><p>No Firebase project is connected, so there is no order history.</p></Empty>;
  }
  if (failed) return <Notice tone="error">Your orders could not be loaded. Check your connection and reload.</Notice>;
  if (!ready || (user && loaded?.uid !== user.uid)) return <Loading label="Loading your orders" />;
  const orders = user ? loaded!.orders : [];

  return (
    <div className="stack">
      <h1>My orders</h1>
      <p className="small muted">Without an account, orders are tied to this browser. Clearing site data removes your access to them.</p>
      {orders.length === 0 ? (
        <Empty title="Your orders will appear here"><Link className="btn" to="/">Browse the store</Link></Empty>
      ) : (
        orders.map((o) => (
          <div className="line" key={o.id}>
            <div className="grow">
              <p><Link to={`/orders/${o.id}`}><strong>{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</strong></Link></p>
              <p className="small muted">Ordered {formatDate(o.createdAtMs)} · Order {o.id.slice(0, 6)}</p>
            </div>
            <span className="tag">{STATUS_LABEL[o.status]}</span>
            <p className="price">{formatPrice(o.totalCents)}</p>
          </div>
        ))
      )}
    </div>
  );
}
