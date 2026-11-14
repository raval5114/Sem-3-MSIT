import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { customerOrderingService, type PlacedOrder } from '../services/customerOrderingService';
import { useAuth } from '../context/AuthContext';
import './kds.css';

export default function KdsPage() {
  const { user, accessContext, refreshAccessContext } = useAuth();
  const restaurantIdentity = accessContext?.restaurantName || accessContext?.restaurantId || 'Kitchen workspace';
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const queue = await customerOrderingService.getKitchenQueue();
      setOrders(queue);
      setError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load kitchen queue';
      setOrders([]);
      setError(msg);
      const status = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
      if (status === 401 || status === 403) void refreshAccessContext();
    } finally {
      setLoading(false);
    }
  }, [refreshAccessContext]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => { void fetchQueue(); }, 0);
    const interval = setInterval(() => { void fetchQueue(); }, 5000);
    return () => {
      window.clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchQueue]);

  const advanceStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    try {
      await customerOrderingService.updateKitchenOrderStatus(orderId, nextStatus);
      await fetchQueue();
    } catch (err: unknown) {
      const responseMessage = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      alert(responseMessage || (err instanceof Error ? err.message : 'Could not advance order status'));
    } finally {
      setUpdatingId(null);
    }
  };

  const statusLabel = (status: string) => ({
    SUBMITTED: 'New', PENDING_KITCHEN: 'New', ACCEPTED: 'Accepted', PREPARING: 'Cooking', READY: 'Ready',
  } as Record<string, string>)[status] || status.replaceAll('_', ' ');

  const statusClass = (status: string) => ({
    SUBMITTED: 'new', PENDING_KITCHEN: 'new', ACCEPTED: 'accepted', PREPARING: 'preparing', READY: 'ready',
  } as Record<string, string>)[status] || 'neutral';

  const getNextAction = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'PENDING_KITCHEN': return { label: 'Accept order', nextStatus: 'ACCEPTED' };
      case 'ACCEPTED': return { label: 'Start cooking', nextStatus: 'PREPARING' };
      case 'PREPARING': return { label: 'Mark ready', nextStatus: 'READY' };
      case 'READY': return { label: 'Mark served', nextStatus: 'SERVED' };
      default: return null;
    }
  };

  const newCount = orders.filter((order) => ['SUBMITTED', 'PENDING_KITCHEN'].includes(order.status)).length;
  const cookingCount = orders.filter((order) => ['ACCEPTED', 'PREPARING'].includes(order.status)).length;
  const readyCount = orders.filter((order) => order.status === 'READY').length;

  return (
    <main className="kds-shell">
      <header className="kds-topbar">
        <Link className="kds-brand" to="/kds" aria-label="DineFlow Kitchen Display">
          <span className="kds-brand-mark">D</span><span>DineFlow<small>KITCHEN DISPLAY</small></span>
        </Link>
        <div className="kds-station"><span className="kds-live-dot" />Live station <i />{restaurantIdentity}</div>
        <div className="kds-top-actions">
          <span className="kds-staff">{accessContext?.displayName || user?.email || 'Kitchen staff'}</span>
          <button className="kds-refresh" onClick={() => { void fetchQueue(); }} aria-label="Refresh orders">↻ <span>Refresh</span></button>
          <Link className="kds-dashboard-link" to="/dashboard">Dashboard <span>↗</span></Link>
        </div>
      </header>

      <section className="kds-content">
        <div className="kds-heading-row">
          <div><p className="kds-eyebrow">SERVICE OVERVIEW</p><h1>Kitchen queue</h1><p className="kds-subtitle">Keep every order moving from prep to pickup.</p></div>
          <div className="kds-ticket-total"><strong>{orders.length.toString().padStart(2, '0')}</strong><span>ACTIVE<br />TICKETS</span></div>
        </div>

        <div className="kds-summary" aria-label="Order counts by status">
          <div className="kds-summary-card"><span className="kds-summary-icon new-icon">✳</span><div><strong>{newCount}</strong><span>New orders</span></div></div>
          <div className="kds-summary-card"><span className="kds-summary-icon cooking-icon">◷</span><div><strong>{cookingCount}</strong><span>In progress</span></div></div>
          <div className="kds-summary-card"><span className="kds-summary-icon ready-icon">✓</span><div><strong>{readyCount}</strong><span>Ready to serve</span></div></div>
          <div className="kds-sync-note"><span className="kds-live-dot" /> Queue syncs automatically</div>
        </div>

        {error && <div className="kds-error" role="alert"><strong>Couldn’t load the kitchen queue</strong><span>{error}</span><button onClick={() => { void fetchQueue(); }}>Try again</button></div>}

        {loading ? <div className="kds-state"><span className="kds-spinner" /><strong>Loading orders</strong><span>Getting the latest tickets from your restaurant.</span></div>
          : orders.length === 0 ? <div className="kds-empty"><div className="kds-empty-art">✓</div><p className="kds-eyebrow">QUEUE CLEAR</p><h2>All caught up</h2><p>New customer orders will appear here automatically.</p><button className="kds-refresh" onClick={() => { void fetchQueue(); }}>↻ Refresh queue</button></div>
            : <div className="kds-grid">{orders.map((order) => {
              const action = getNextAction(order.status);
              const canCancel = ['SUBMITTED', 'PENDING_KITCHEN', 'ACCEPTED'].includes(order.status);
              const isUpdating = updatingId === order.id;
              const shortId = order.id.slice(0, 8).toUpperCase();
              const time = new Date(order.createdAt);
              return <article className={`kds-ticket ${statusClass(order.status)}`} key={order.id}>
                <div className="kds-ticket-head"><div><span className="kds-ticket-label">ORDER TICKET</span><h2>#{shortId}</h2></div><span className={`kds-status ${statusClass(order.status)}`}><i />{statusLabel(order.status)}</span></div>
                <div className="kds-ticket-meta"><span>▦ Table order</span><span>◷ {Number.isNaN(time.getTime()) ? 'Just now' : time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className={order.paymentStatus === 'PAID' ? 'paid' : 'counter'}>{order.paymentStatus === 'PAID' ? 'Paid' : 'Counter'}</span></div>
                <div className="kds-items-heading">ITEMS <span>{order.items.reduce((total, item) => total + item.quantity, 0)} total</span></div>
                <div className="kds-items">{order.items.map((item, idx) => <div className="kds-item" key={item.id ?? idx}>
                  <span className="kds-quantity">{item.quantity}×</span><div className="kds-item-copy"><strong>{item.name}</strong>{item.selections?.length > 0 && <span>{item.selections.map((selection) => `${selection.groupName}: ${selection.optionName}`).join(' · ')}</span>}</div>
                </div>)}</div>
                <footer className="kds-ticket-actions">{action && <button className="kds-primary-action" onClick={() => { void advanceStatus(order.id, action.nextStatus); }} disabled={isUpdating}>{isUpdating ? <><span className="kds-button-spinner" />Updating</> : <>{action.label}<span>→</span></>}</button>}{canCancel && <button className="kds-cancel-action" onClick={() => { if (confirm(`Cancel order #${shortId}?`)) void advanceStatus(order.id, 'CANCELLED'); }} disabled={isUpdating}>Cancel</button>}</footer>
              </article>;
            })}</div>}
        <div className="kds-footnote">DINEFLOW <span>·</span> KITCHEN OPERATIONS</div>
      </section>
    </main>
  );
}
