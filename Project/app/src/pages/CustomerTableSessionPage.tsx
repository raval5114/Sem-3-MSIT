import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { tableService, type TableSessionResponse } from '../services/tableService';
import '../dashboard.css';

export default function CustomerTableSessionPage() {
  const { restaurantId, tableId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);
  const [session, setSession] = useState<TableSessionResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const qrToken = new URLSearchParams(location.search).get('token');
    navigate(location.pathname, { replace: true });
    async function startSession() {
      if (!restaurantId || !tableId || !qrToken) {
        setError('This table QR code is incomplete. Please scan the QR displayed at your table.');
        setLoading(false);
        return;
      }
      try {
        const result = await tableService.initializeSession(tableId, qrToken);
        if (result.restaurantId !== restaurantId || result.tableId !== tableId) {
          throw new Error('This QR code does not match the table address. Please ask staff for help.');
        }
        sessionStorage.setItem('customer_access_token', result.accessToken);
        sessionStorage.setItem('customer_table_session', JSON.stringify({
          restaurantId: result.restaurantId,
          tableId: result.tableId,
          tableNumber: result.tableNumber,
          tableSessionId: result.tableSessionId,
          expiresAt: result.expiresAt,
        }));
        setSession(result);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'We could not start your table session. Please scan again or ask staff.');
      } finally {
        setLoading(false);
      }
    }
    void startSession();
  }, [location.pathname, location.search, navigate, restaurantId, tableId]);

  return <main className="df-customer-session-page">
    <section className="df-customer-session-card">
      <div className="df-brand-mark">d<span>.</span></div>
      <p className="df-eyebrow">DINEFLOW · TABLE ORDERING</p>
      {loading ? <><h1>Connecting your table…</h1><p>We’re securely starting your dining session.</p><div className="df-session-spinner" aria-label="Loading" /></> : error ? <><span className="df-pill muted">SESSION NOT STARTED</span><h1>We couldn’t connect this table</h1><p>{error}</p><button className="df-button df-button-primary" onClick={() => window.location.reload()}>Try again</button></> : session ? <><span className="df-pill success">TABLE CONNECTED</span><h1>Welcome to your table</h1><p>Your session is ready. Browse the menu and add items to your order.</p><div className="df-session-summary"><span>Table</span><strong>{session.tableNumber}</strong><span>Session</span><code>{session.tableSessionId.slice(0, 8)}</code></div><small className="df-session-note">Your session expires at {new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(session.expiresAt))}.</small><button className="df-button df-button-primary" style={{ marginTop: 18 }} onClick={() => navigate(`/r/${restaurantId}/t/${tableId}/menu`)}>Browse menu</button></> : null}
    </section>
  </main>;
}
