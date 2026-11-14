import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  authService,
  type AuditLog,
  type Page,
  type PlatformRestaurant,
  type RestaurantRegistration,
} from '../services/authService';
import SubscriptionManagementPanel from './SubscriptionManagementPanel';
import '../platform-dashboard.css';

type PlatformTab = 'registrations' | 'restaurants' | 'subscriptions' | 'audit';
type PlatformData = Page<RestaurantRegistration> | Page<PlatformRestaurant> | Page<AuditLog>;

const tabLabels: Record<PlatformTab, string> = {
  registrations: 'Applications',
  restaurants: 'Restaurants',
  subscriptions: 'Plans & access',
  audit: 'Audit history',
};

function messageFrom(cause: unknown): string {
  const error = cause as { response?: { data?: { message?: string; detail?: string } }; message?: string };
  return error.response?.data?.message ?? error.response?.data?.detail ?? error.message ?? 'The request could not be completed.';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function PlatformDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PlatformTab>('registrations');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    if (tab === 'subscriptions') {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      let result: PlatformData;
      if (tab === 'registrations') {
        result = await authService.platform.listRegistrations({ status: statusFilter || undefined, query: search || undefined, page });
      } else if (tab === 'restaurants') {
        result = await authService.platform.listRestaurants({ status: statusFilter || undefined, query: search || undefined, page });
      } else {
        result = await authService.platform.listAuditLogs({ page });
      }
      setData(result);
    } catch (cause) {
      setError(messageFrom(cause));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const changeTab = (next: PlatformTab) => {
    setTab(next);
    setPage(0);
    setStatusFilter('');
    setSearch('');
    setNotice('');
  };

  const runAction = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await loadData();
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusyId('');
    }
  };

  const approve = (registration: RestaurantRegistration) => {
    if (!window.confirm(`Approve ${registration.restaurantName}? This creates its unique Restaurant ID.`)) return;
    void runAction(registration.id, () => authService.platform.approveRegistration(registration.id), 'Restaurant application approved.');
  };

  const reject = (registration: RestaurantRegistration) => {
    const reason = window.prompt(`Why are you rejecting ${registration.restaurantName}?`);
    if (!reason?.trim()) return;
    void runAction(registration.id, () => authService.platform.rejectRegistration(registration.id, reason.trim()), 'Application rejected.');
  };

  const suspend = (restaurant: PlatformRestaurant) => {
    const reason = window.prompt(`Why are you suspending ${restaurant.name}?`);
    if (!reason?.trim()) return;
    void runAction(restaurant.restaurantId,
      () => authService.platform.suspendRestaurant(restaurant.restaurantId, reason.trim()),
      'Restaurant suspended.');
  };

  const reactivate = (restaurant: PlatformRestaurant) => {
    if (!window.confirm(`Reactivate ${restaurant.name}?`)) return;
    void runAction(restaurant.restaurantId,
      () => authService.platform.reactivateRestaurant(restaurant.restaurantId),
      'Restaurant reactivated.');
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const currentPage = data;
  const registrations = tab === 'registrations' ? currentPage as Page<RestaurantRegistration> | null : null;
  const restaurants = tab === 'restaurants' ? currentPage as Page<PlatformRestaurant> | null : null;
  const audits = tab === 'audit' ? currentPage as Page<AuditLog> | null : null;
  const pendingCount = registrations?.content.filter((item) => item.status === 'PENDING').length ?? 0;

  return (
    <div className="df-platform-shell">
      <aside className="df-platform-sidebar">
        <a className="df-platform-brand" href="/platform"><span>d.</span><strong>DineFlow<small>PLATFORM ADMIN</small></strong></a>
        <div className="df-platform-sidebar-label">WORKSPACE</div>
        <nav aria-label="Platform navigation">
          {(Object.keys(tabLabels) as PlatformTab[]).map((item) => (
            <button key={item} className={`df-platform-nav-item ${tab === item ? 'active' : ''}`} onClick={() => changeTab(item)}>
              <span aria-hidden="true">{item === 'registrations' ? '▤' : item === 'restaurants' ? '⌂' : '◷'}</span>
              {tabLabels[item]}
              {item === 'registrations' && pendingCount > 0 && <small>{pendingCount}</small>}
            </button>
          ))}
        </nav>
        <div className="df-platform-sidebar-bottom">
          <div className="df-platform-admin-card"><span className="df-platform-admin-avatar">{user?.email?.slice(0, 1).toUpperCase() ?? 'A'}</span><span><strong>{user?.email}</strong><small>SUPER ADMIN</small></span></div>
          <button className="df-platform-signout" onClick={handleLogout}>↗ <span>Sign out</span></button>
        </div>
      </aside>
      <main className="df-platform-main">
        <header className="df-platform-topbar"><div><span className="df-platform-status-dot" /> Platform workspace</div><time>{new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</time></header>
        <section className="df-platform-content">
          <div className="df-platform-page-heading">
            <div><p className="df-platform-eyebrow">DINEFLOW · PLATFORM</p><h1>{tabLabels[tab]}</h1><p>{tab === 'registrations' ? 'Review new restaurant applications and manage approval decisions.' : tab === 'restaurants' ? 'Manage restaurant status and platform access.' : tab === 'subscriptions' ? 'Configure feature plans, subscriptions, and restaurant overrides.' : 'Review platform changes and their outcomes.'}</p></div>
            <div className="df-platform-heading-badge"><span>◆</span> Super Admin</div>
          </div>
          {tab === 'subscriptions' ? <SubscriptionManagementPanel /> : <>
          <div className="df-platform-metrics">
            <article><span>REVIEW QUEUE</span><strong>{tab === 'registrations' && !loading ? registrations?.totalElements ?? 0 : '—'}</strong><small>Restaurant applications</small></article>
            <article><span>RESTAURANTS</span><strong>{tab === 'restaurants' && !loading ? restaurants?.totalElements ?? 0 : '—'}</strong><small>Platform directory</small></article>
            <article><span>ADMIN ACTIVITY</span><strong>{tab === 'audit' && !loading ? audits?.totalElements ?? 0 : '—'}</strong><small>Recorded audit events</small></article>
          </div>
          <section className="df-platform-panel">
            <div className="df-platform-panel-header">
              <div><h2>{tab === 'registrations' ? 'Restaurant applications' : tab === 'restaurants' ? 'Restaurant directory' : 'Recent audit events'}</h2><p>{tab === 'audit' ? 'State-changing platform actions are recorded here.' : 'Use filters to find and review platform records.'}</p></div>
              {tab !== 'audit' && <div className="df-platform-filters">
                <label className="df-platform-search"><span aria-hidden="true">⌕</span><input aria-label="Search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search..." /></label>
                <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
                  <option value="">All statuses</option>
                  {(tab === 'registrations' ? ['PENDING', 'APPROVED', 'REJECTED'] : ['ACTIVE', 'SUSPENDED', 'INACTIVE']).map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
              </div>}
            </div>
            {notice && <div className="df-platform-alert success" role="status">{notice}</div>}
            {error && <div className="df-platform-alert error" role="alert"><span>{error}</span><button onClick={() => void loadData()}>Retry</button></div>}
            {loading ? <div className="df-platform-empty" role="status">Loading {tabLabels[tab].toLowerCase()}…</div>
              : tab === 'registrations' ? <RegistrationTable data={registrations?.content ?? []} busyId={busyId} onApprove={approve} onReject={reject} />
                : tab === 'restaurants' ? <RestaurantTable data={restaurants?.content ?? []} busyId={busyId} onSuspend={suspend} onReactivate={reactivate} />
                  : <AuditTable data={audits?.content ?? []} />}
            {!loading && currentPage && currentPage.totalPages > 0 && <div className="df-platform-pagination">
              <span>Page {currentPage.number + 1} of {Math.max(currentPage.totalPages, 1)} · {currentPage.totalElements} records</span>
              <div><button disabled={currentPage.first} onClick={() => setPage((current) => Math.max(0, current - 1))}>← Previous</button><button disabled={currentPage.last} onClick={() => setPage((current) => current + 1)}>Next →</button></div>
            </div>}
          </section>
          </>}
        </section>
      </main>
    </div>
  );
}

function RegistrationTable({ data, busyId, onApprove, onReject }: {
  data: RestaurantRegistration[];
  busyId: string;
  onApprove: (registration: RestaurantRegistration) => void;
  onReject: (registration: RestaurantRegistration) => void;
}) {
  if (!data.length) return <div className="df-platform-empty"><span>▤</span><strong>No applications found</strong><p>New restaurant applications will appear here.</p></div>;
  return <div className="df-platform-table-wrap"><table className="df-platform-table"><thead><tr><th>RESTAURANT / CONTACT</th><th>SUBMITTED</th><th>STATUS</th><th>REVIEW</th></tr></thead><tbody>
    {data.map((item) => <tr key={item.id}><td><strong>{item.restaurantName}</strong><small>{item.ownerName} · {item.ownerEmail}</small>{item.phone && <small>{item.phone}</small>}{item.address && <small>{item.address}</small>}{item.rejectionReason && <small className="df-platform-rejection">Reason: {item.rejectionReason}</small>}</td><td>{formatDate(item.createdAt)}</td><td><span className={`df-platform-pill ${item.status.toLowerCase()}`}>{item.status.replaceAll('_', ' ')}</span>{item.restaurantId && <small className="df-platform-id">{item.restaurantId}</small>}</td><td>{item.status === 'PENDING' ? <div className="df-platform-row-actions"><button disabled={busyId === item.id} onClick={() => onApprove(item)}>Approve</button><button className="danger" disabled={busyId === item.id} onClick={() => onReject(item)}>Reject</button></div> : <span className="df-platform-muted">{item.reviewedAt ? formatDate(item.reviewedAt) : 'Reviewed'}</span>}</td></tr>)}
  </tbody></table></div>;
}

function RestaurantTable({ data, busyId, onSuspend, onReactivate }: {
  data: PlatformRestaurant[];
  busyId: string;
  onSuspend: (restaurant: PlatformRestaurant) => void;
  onReactivate: (restaurant: PlatformRestaurant) => void;
}) {
  if (!data.length) return <div className="df-platform-empty"><span>⌂</span><strong>No restaurants found</strong><p>Approved restaurants will appear here.</p></div>;
  return <div className="df-platform-table-wrap"><table className="df-platform-table"><thead><tr><th>RESTAURANT</th><th>RESTAURANT ID</th><th>STATUS</th><th>ADDED</th><th>ACTION</th></tr></thead><tbody>
    {data.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><code>{item.restaurantId}</code></td><td><span className={`df-platform-pill ${item.status.toLowerCase()}`}>{item.status.replaceAll('_', ' ')}</span></td><td>{formatDate(item.createdAt)}</td><td>{item.status === 'ACTIVE' ? <button className="df-platform-table-action danger" disabled={busyId === item.restaurantId} onClick={() => onSuspend(item)}>Suspend</button> : item.status === 'SUSPENDED' ? <button className="df-platform-table-action" disabled={busyId === item.restaurantId} onClick={() => onReactivate(item)}>Reactivate</button> : <span className="df-platform-muted">—</span>}</td></tr>)}
  </tbody></table></div>;
}

function AuditTable({ data }: { data: AuditLog[] }) {
  if (!data.length) return <div className="df-platform-empty"><span>◷</span><strong>No audit events yet</strong><p>Platform lifecycle actions will be recorded here.</p></div>;
  return <div className="df-platform-table-wrap"><table className="df-platform-table"><thead><tr><th>ACTION</th><th>RESOURCE</th><th>ACTOR</th><th>OUTCOME</th><th>WHEN</th></tr></thead><tbody>
    {data.map((item) => <tr key={item.id}><td><strong>{item.action.replaceAll('_', ' ').toLowerCase()}</strong>{item.reason && <small>{item.reason}</small>}</td><td>{item.resourceType}<small>{item.resourceId ?? item.restaurantId ?? 'Platform'}</small></td><td><code>{item.actorId ?? 'System'}</code></td><td><span className={`df-platform-pill ${item.outcome.toLowerCase()}`}>{item.outcome}</span></td><td>{formatDate(item.createdAt)}</td></tr>)}
  </tbody></table></div>;
}
