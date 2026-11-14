import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell, { type DashboardView } from '../components/dashboard/AppShell';
import PageHeader from '../components/dashboard/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
  restaurantAdminService,
  type RestaurantSettings,
  type StaffAccount,
  type StaffRolePermissions,
} from '../services/restaurantAdminService';
import '../dashboard.css';

const emptyStaff = { name: '', email: '', password: '', roleName: 'WAITER' as StaffAccount['role'] };

export default function RestaurantAdminPage() {
  const { user, accessContext, logout, refreshAccessContext } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [roles, setRoles] = useState<StaffRolePermissions[]>([]);
  const [staffForm, setStaffForm] = useState(emptyStaff);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [currentSettings, currentStaff, currentRoles] = await Promise.all([
        restaurantAdminService.getSettings(),
        restaurantAdminService.listStaff(),
        restaurantAdminService.listRolePermissions(),
      ]);
      setSettings(currentSettings);
      setStaff(currentStaff);
      setRoles(currentRoles);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The restaurant workspace could not be loaded.');
      void refreshAccessContext();
    } finally {
      setLoading(false);
    }
  }, [refreshAccessContext]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await restaurantAdminService.updateSettings({
        name: settings.name,
        contactPhone: settings.contactPhone,
        address: settings.address,
      });
      setSettings(saved);
      setNotice('Restaurant settings saved.');
      void refreshAccessContext();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restaurant settings could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const addStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const created = await restaurantAdminService.createStaff(staffForm);
      setStaff((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setStaffForm(emptyStaff);
      setNotice(`${created.name} was added as ${created.role.replaceAll('_', ' ').toLowerCase()}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The staff account could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const toggleStaff = async (account: StaffAccount) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await restaurantAdminService.setStaffActive(account.id, !account.active);
      setStaff((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setNotice(`${updated.name} is now ${updated.active ? 'active' : 'inactive'}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The staff account could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const navigateTo = (view: DashboardView) => {
    if (view === 'admin') return;
    const paths: Partial<Record<DashboardView, string>> = {
      overview: '/dashboard', menu: '/menu', orders: '/orders', kitchen: '/kds',
      waiter: '/waiter', tables: '/tables', revenue: '/analytics', payments: '/payments',
    };
    if (paths[view]) navigate(paths[view]);
  };

  return (
    <AppShell
      user={user ?? {}}
      activeView="admin"
      onNavigate={navigateTo}
      onLogout={() => { logout(); navigate('/login'); }}
    >
      <PageHeader
        eyebrow="RESTAURANT ADMINISTRATION"
        title={`${settings?.name || accessContext?.restaurantName || 'Restaurant'} settings`}
        description="Manage your restaurant profile, staff accounts, and the permissions attached to each staff role."
        action={{ label: loading ? 'Loading…' : 'Refresh', onClick: () => void loadWorkspace() }}
      />
      {error && <div className="df-alert error" role="alert">{error}<button onClick={() => void loadWorkspace()}>Retry</button></div>}
      {notice && <div className="df-alert success" role="status">{notice}</div>}
      {loading || !settings ? <div className="df-panel df-empty" role="status">Loading authorized restaurant administration…</div> : (
        <div className="df-admin-grid">
          <section className="df-panel">
            <div className="df-panel-heading"><div><p className="df-eyebrow">RESTAURANT PROFILE</p><h2>Restaurant settings</h2></div></div>
            <form className="df-form-grid" onSubmit={(event) => void saveSettings(event)}>
              <label>Restaurant name<input required maxLength={200} value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} /></label>
              <label>Contact phone<input maxLength={32} value={settings.contactPhone ?? ''} onChange={(event) => setSettings({ ...settings, contactPhone: event.target.value || null })} /></label>
              <label className="df-form-wide">Address<textarea maxLength={2000} rows={3} value={settings.address ?? ''} onChange={(event) => setSettings({ ...settings, address: event.target.value || null })} /></label>
              <div><button className="df-button df-button-primary" type="submit" disabled={busy}>Save settings</button></div>
            </form>
          </section>

          <section className="df-panel">
            <div className="df-panel-heading"><div><p className="df-eyebrow">ROLE CATALOGUE</p><h2>Staff role permissions</h2></div></div>
            <p className="df-footnote">These platform-defined permissions apply to every account with the selected role. Assign roles below; permission policy itself is centrally managed.</p>
            <div className="df-role-grid">
              {roles.map((role) => (
                <article className="df-role-card" key={role.role}>
                  <h3>{role.role.replaceAll('_', ' ')}</h3>
                  <ul>{role.permissions.map((permission) => <li key={permission}>{permission.replaceAll('_', ' ')}</li>)}</ul>
                </article>
              ))}
            </div>
          </section>

          <section className="df-panel df-admin-staff">
            <div className="df-panel-heading"><div><p className="df-eyebrow">TEAM ACCESS</p><h2>Staff accounts</h2></div><span className="df-pill muted">{staff.filter((account) => account.active).length} active</span></div>
            <form className="df-form-grid" onSubmit={(event) => void addStaff(event)}>
              <label>Full name<input required maxLength={200} value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} /></label>
              <label>Email<input required type="email" maxLength={320} value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></label>
              <label>Temporary password<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={staffForm.password} onChange={(event) => setStaffForm({ ...staffForm, password: event.target.value })} /></label>
              <label>Role<select value={staffForm.roleName} onChange={(event) => setStaffForm({ ...staffForm, roleName: event.target.value as StaffAccount['role'] })}><option value="WAITER">Waiter</option><option value="CHEF">Chef</option><option value="CASHIER">Cashier</option></select></label>
              <div><button className="df-button df-button-primary" type="submit" disabled={busy}>Add staff account</button></div>
            </form>
            <div className="df-table-wrap">
              <table className="df-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{staff.map((account) => (
                  <tr key={account.id}>
                    <td><strong>{account.name}</strong></td><td>{account.email}</td><td>{account.role.replaceAll('_', ' ')}</td>
                    <td><span className={`df-pill ${account.active ? 'success' : 'muted'}`}>{account.active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="df-text-button" disabled={busy} onClick={() => void toggleStaff(account)}>{account.active ? 'Deactivate' : 'Reactivate'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {!staff.length && <div className="df-empty">No staff accounts yet. Add your first waiter, chef, or cashier.</div>}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
