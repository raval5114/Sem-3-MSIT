import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { customerOrderingService, type PlacedOrder } from '../services/customerOrderingService';
import { useAuth } from '../context/AuthContext';
import '../customer-order.css';

export default function KdsPage() {
  const { user } = useAuth();
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
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Poll every 5s for real-time ticket catch-up
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const advanceStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    try {
      await customerOrderingService.updateOrderStatus(orderId, nextStatus);
      await fetchQueue();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not advance order status');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'READY': return '#16a34a';
      case 'PREPARING': return '#ea580c';
      case 'ACCEPTED': return '#2563eb';
      case 'PENDING_KITCHEN':
      case 'SUBMITTED': return '#d97706';
      default: return '#64748b';
    }
  };

  const getNextAction = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'PENDING_KITCHEN':
        return { label: 'Accept Ticket', nextStatus: 'ACCEPTED' };
      case 'ACCEPTED':
        return { label: 'Start Cooking', nextStatus: 'PREPARING' };
      case 'PREPARING':
        return { label: 'Mark Ready', nextStatus: 'READY' };
      case 'READY':
        return { label: 'Mark Served', nextStatus: 'SERVED' };
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: '#f97316' }}>DineFlow KDS</span>
            <span style={{ background: '#1e293b', border: '1px solid #475569', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, color: '#38bdf8' }}>
              ● Live Kitchen Station
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '12px' }}>
            Active tickets: <strong>{orders.length}</strong> · Staff: {user?.email || 'Chef Station'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => fetchQueue()}
            style={{ background: '#334155', color: '#f8fafc', border: '1px solid #475569', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            ↻ Refresh Queue
          </button>
          <Link
            to="/dashboard"
            style={{ background: '#f97316', color: '#fff', textDecoration: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700 }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      {error && (
        <div style={{ background: '#7f1d1d', border: '1px solid #b91c1c', padding: '12px 16px', borderRadius: '8px', color: '#fecaca', marginBottom: '20px', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: '14px' }}>
          Loading kitchen queue…
        </div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', background: '#1e293b', borderRadius: '16px', border: '1px dashed #475569', color: '#94a3b8' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🍳</div>
          <h2 style={{ color: '#e2e8f0', fontSize: '18px', margin: '0 0 6px' }}>All caught up! No active tickets</h2>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Incoming customer orders will automatically appear here in real-time.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {orders.map((order) => {
            const action = getNextAction(order.status);
            const isUpdating = updatingId === order.id;

            return (
              <div
                key={order.id}
                style={{
                  background: '#1e293b',
                  borderRadius: '12px',
                  border: `2px solid ${statusColor(order.status)}`,
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '16px', color: '#f8fafc' }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span
                      style={{
                        background: `${statusColor(order.status)}22`,
                        color: statusColor(order.status),
                        border: `1px solid ${statusColor(order.status)}66`,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.5px',
                      }}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', fontSize: '11px', color: '#94a3b8' }}>
                    <span style={{ background: '#334155', padding: '3px 8px', borderRadius: '4px', color: '#e2e8f0' }}>
                      Table Order
                    </span>
                    <span
                      style={{
                        background: order.paymentStatus === 'PAID' ? '#14532d' : '#78350f',
                        color: order.paymentStatus === 'PAID' ? '#86efac' : '#fde047',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      {order.paymentStatus === 'PAID' ? 'PAID' : 'PAY AT COUNTER'}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', borderBottom: '1px solid #334155', padding: '12px 0', margin: '12px 0' }}>
                    {order.items.map((item, idx) => (
                      <div key={item.id ?? idx} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                          <span>
                            <strong style={{ color: '#f97316', marginRight: '6px' }}>{item.quantity}×</strong>
                            {item.name}
                          </span>
                        </div>
                        {item.selections && item.selections.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', paddingLeft: '22px', marginTop: '2px' }}>
                            {item.selections.map((s) => `${s.groupName}: ${s.optionName}`).join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  {action && (
                    <button
                      onClick={() => advanceStatus(order.id, action.nextStatus)}
                      disabled={isUpdating}
                      style={{
                        flex: 1,
                        background: statusColor(order.status),
                        color: '#fff',
                        border: 'none',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        opacity: isUpdating ? 0.6 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      {isUpdating ? 'Updating…' : `➔ ${action.label}`}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(`Cancel ticket #${order.id.slice(0, 8)}?`)) {
                        advanceStatus(order.id, 'CANCELLED');
                      }
                    }}
                    disabled={isUpdating}
                    style={{
                      background: 'transparent',
                      color: '#ef4444',
                      border: '1px solid #7f1d1d',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

