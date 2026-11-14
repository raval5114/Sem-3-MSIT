import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell, { type DashboardView } from '../components/dashboard/AppShell';
import PageHeader from '../components/dashboard/PageHeader';
import { useAuth } from '../context/AuthContext';
import { customerOrderingService, type PlacedOrder } from '../services/customerOrderingService';
import { tableService, type RestaurantTable } from '../services/tableService';
import '../dashboard.css';

type Workspace = 'orders' | 'waiter' | 'cashier';

const workspaceInfo: Record<Workspace, { view: DashboardView; feature: string; title: string; eyebrow: string; description: string }> = {
  orders: {
    view: 'orders',
    feature: 'ORDER_MANAGEMENT',
    title: 'Active orders',
    eyebrow: 'RESTAURANT OPERATIONS',
    description: 'Review active restaurant orders using your current role permissions.',
  },
  waiter: {
    view: 'waiter',
    feature: 'WAITER_OPERATIONS',
    title: 'Waiter service',
    eyebrow: 'TABLE SERVICE',
    description: 'Track active tickets and mark ready orders as served.',
  },
  cashier: {
    view: 'payments',
    feature: 'CASHIER_OPERATIONS',
    title: 'Cashier workspace',
    eyebrow: 'BILLING & PAYMENTS',
    description: 'Review active order totals and payment status for your restaurant.',
  },
};

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR' }).format(amount);
}

function describeError(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The operations service could not complete the request.';
}

export default function RoleOperationsPage({ workspace }: { workspace: Workspace }) {
  const { accessContext, user, logout, hasPrivilege, refreshAccessContext } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [assignedTables, setAssignedTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const cashIdempotencyKeys = useRef<Record<string, string>>({});
  const info = workspaceInfo[workspace];

  const refresh = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const currentOrders = await customerOrderingService.getOperationsQueue(workspace);
      setOrders(currentOrders);
      if (workspace === 'waiter') setAssignedTables(await tableService.listMyAssignedTables());
    } catch (cause) {
      setError(describeError(cause));
      setOrders([]);
      const status = typeof cause === 'object' && cause !== null && 'response' in cause
        ? (cause as { response?: { status?: number } }).response?.status
        : undefined;
      if (status === 401 || status === 403) void refreshAccessContext();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshAccessContext, workspace]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { void refresh(true); }, 15_000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const markServed = async (order: PlacedOrder) => {
    setBusyOrder(order.id);
    setError('');
    try {
      await customerOrderingService.markOrderServed(order.id);
      await refresh(true);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyOrder('');
    }
  };

  const cancelOrder = async (order: PlacedOrder) => {
    if (!window.confirm(`Cancel order #${order.id.slice(0, 8)}?`)) return;
    setBusyOrder(order.id);
    setError('');
    try {
      await customerOrderingService.updateOrderStatus(order.id, 'CANCELLED');
      await refresh(true);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusyOrder('');
    }
  };

  const recordCashPayment = async (order: PlacedOrder) => {
    if (!window.confirm(`Confirm that you received ${money(order.total, order.currency)} in cash for order #${order.id.slice(0, 8)}?`)) return;
    setBusyOrder(order.id);
    setError('');
    let requestError = '';
    try {
      const idempotencyKey = cashIdempotencyKeys.current[order.id] ?? crypto.randomUUID();
      cashIdempotencyKeys.current[order.id] = idempotencyKey;
      await customerOrderingService.recordCounterPayment(order.id, idempotencyKey);
      delete cashIdempotencyKeys.current[order.id];
    } catch (cause) {
      requestError = describeError(cause);
    }
    await refresh(true);
    if (requestError) setError(requestError);
    setBusyOrder('');
  };

  const navigateTo = (view: DashboardView) => {
    const paths: Partial<Record<DashboardView, string>> = {
      overview: '/dashboard',
      menu: '/menu',
      orders: '/orders',
      kitchen: '/kds',
      waiter: '/waiter',
      tables: '/tables',
      revenue: '/analytics',
      payments: '/payments',
    };
    navigate(paths[view] ?? '/dashboard');
  };

  return (
    <AppShell
      user={user ?? {}}
      activeView={info.view}
      onNavigate={navigateTo}
      onLogout={() => { logout(); navigate('/login'); }}
    >
      <PageHeader
        eyebrow={info.eyebrow}
        title={info.title}
        description={info.description}
        action={{ label: refreshing ? 'Refreshing…' : 'Refresh', onClick: () => void refresh(true) }}
      />
      {error && <div className="df-alert error" role="alert">{error}<button onClick={() => void refresh()}>Retry</button></div>}
      {workspace === 'cashier' && (
        <div className="df-alert warning">
          Cash payments are recorded server-side against the authenticated cashier and settled order total. Never record a payment before cash is received.
        </div>
      )}
      {workspace === 'waiter' && <section className="df-panel df-waiter-tables"><div className="df-panel-heading"><div><p className="df-eyebrow">YOUR SECTION</p><h2>{assignedTables.length} assigned tables</h2></div></div><div className="df-assigned-table-list">{assignedTables.map((table) => <span className="df-pill success" key={table.id}>{table.displayName || `Table ${table.tableNumber}`}</span>)}{!assignedTables.length && <p className="df-footnote">No tables are assigned yet. Ask your restaurant administrator to set up your section.</p>}</div></section>}
      <section className="df-panel">
        <div className="df-panel-heading">
          <div><p className="df-eyebrow">{accessContext?.restaurantName || accessContext?.restaurantId || 'RESTAURANT'}</p><h2>{orders.length} {workspace === 'cashier' ? 'orders to review' : 'active orders'}</h2></div>
          <span className="df-pill success">Auto-refreshes every 15 seconds</span>
        </div>
        {loading ? <div className="df-empty" role="status">Loading authorized restaurant orders…</div> : orders.length === 0 ? (
          <div className="df-empty"><strong>No active orders</strong><p>New restaurant orders will appear here when available.</p></div>
        ) : (
          <div className="df-table-wrap">
            <table className="df-table">
              <thead><tr><th>Order</th><th>Table</th><th>Items</th><th>Order status</th><th>Payment</th><th>Total</th><th>Action</th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></td>
                    <td>{order.tableId ? assignedTables.find((table) => table.id === order.tableId)?.displayName || assignedTables.find((table) => table.id === order.tableId)?.tableNumber || order.tableId.slice(0, 8) : '—'}</td>
                    <td>{order.items.reduce((quantity, item) => quantity + item.quantity, 0)}</td>
                    <td><span className="df-pill muted">{order.status.replaceAll('_', ' ')}</span></td>
                    <td><span className={`df-pill ${order.paymentStatus === 'PAID' ? 'success' : 'muted'}`}>{order.paymentStatus.replaceAll('_', ' ')}</span></td>
                    <td>{money(order.total, order.currency)}</td>
                    {workspace === 'cashier' ? (
                      <td>{['UNPAID', 'PENDING', 'FAILED'].includes(order.paymentStatus) && hasPrivilege('PAYMENT_PROCESS') ? (
                        <button className="df-button df-button-primary" disabled={busyOrder === order.id} onClick={() => void recordCashPayment(order)}>
                          {busyOrder === order.id ? 'Recording…' : 'Record cash payment'}
                        </button>
                      ) : <span>—</span>}</td>
                    ) : (
                      <td>
                        {workspace === 'waiter' && order.status === 'READY' && hasPrivilege('ORDER_UPDATE_STATUS') ? (
                          <button className="df-button df-button-primary" disabled={busyOrder === order.id} onClick={() => void markServed(order)}>
                            {busyOrder === order.id ? 'Updating…' : 'Mark served'}
                          </button>
                        ) : workspace === 'orders' && ['SUBMITTED', 'PENDING_KITCHEN', 'ACCEPTED'].includes(order.status) && hasPrivilege('ORDER_CANCEL') ? (
                          <button className="df-button df-button-subtle" disabled={busyOrder === order.id} onClick={() => void cancelOrder(order)}>
                            {busyOrder === order.id ? 'Updating…' : 'Cancel order'}
                          </button>
                        ) : <span>—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
