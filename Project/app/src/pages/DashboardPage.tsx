import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: '#7c3aed',
  RESTAURANT_ADMIN: '#1d4ed8',
  CHEF: '#b45309',
  WAITER: '#047857',
  CASHIER: '#0f766e',
  CUSTOMER_GUEST: '#64748b',
};

const ROLE_ICONS: Record<string, string> = {
  SUPER_ADMIN: '👑',
  RESTAURANT_ADMIN: '🏢',
  CHEF: '🍳',
  WAITER: '🚶',
  CASHIER: '💳',
  CUSTOMER_GUEST: '📱',
};

export default function DashboardPage() {
  const { user, logout, hasPrivilege } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const primaryRole = user?.roles?.[0] ?? 'UNKNOWN';
  const roleColor = ROLE_COLORS[primaryRole] ?? '#64748b';
  const roleIcon = ROLE_ICONS[primaryRole] ?? '👤';

  const formatSub = (sub: string) => sub.replace('u_', '').substring(0, 8) + '...';

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <span className="brand-icon">🍽️</span>
          <span className="brand-name">DineFlow</span>
        </div>
        <div className="header-actions">
          <div className="user-badge">
            <span className="user-avatar" style={{ backgroundColor: roleColor }}>
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </span>
            <div className="user-info">
              <span className="user-email">{user?.email}</span>
              <span className="user-role" style={{ color: roleColor }}>
                {roleIcon} {primaryRole.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button className="auth-btn danger" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <h2>Welcome back!</h2>
          <p>You are signed in as <strong>{user?.email}</strong> with the <strong>{primaryRole}</strong> role.</p>
        </div>

        {/* Identity Card */}
        <div className="identity-grid">
          <div className="identity-card">
            <h3>🪪 Identity</h3>
            <div className="identity-rows">
              <div className="identity-row">
                <span className="id-label">User ID</span>
                <span className="id-value mono">{user?.sub ? formatSub(user.sub) : '—'}</span>
              </div>
              <div className="identity-row">
                <span className="id-label">Email</span>
                <span className="id-value">{user?.email ?? '—'}</span>
              </div>
              <div className="identity-row">
                <span className="id-label">Restaurant ID</span>
                <span className="id-value mono">{user?.restaurantId ?? '—'}</span>
              </div>
              <div className="identity-row">
                <span className="id-label">Account Type</span>
                <span className="id-value">{user?.type ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="identity-card">
            <h3>🛡️ Assigned Roles</h3>
            <div className="tags-list">
              {user?.roles?.map((role) => (
                <span key={role} className="tag role-tag" style={{ backgroundColor: ROLE_COLORS[role] ?? '#64748b' }}>
                  {ROLE_ICONS[role]} {role}
                </span>
              )) ?? <span className="no-data">No roles assigned</span>}
            </div>
          </div>

          {/* Privileges */}
          <div className="identity-card full-width">
            <h3>🔑 Privileges</h3>
            <div className="tags-list">
              {user?.privileges?.length
                ? user.privileges.map((priv) => (
                    <span key={priv} className="tag priv-tag">{priv}</span>
                  ))
                : <span className="no-data">No privileges assigned</span>}
            </div>
          </div>

          {/* Quick Access based on privileges */}
          <div className="identity-card full-width">
            <h3>⚡ Quick Access</h3>
            <div className="quick-access-grid">
              {hasPrivilege('MENU_READ') && (
                <div className="quick-card">
                  <span>🍔</span>
                  <p>Menu</p>
                </div>
              )}
              {hasPrivilege('ORDER_READ_ACTIVE') && (
                <div className="quick-card">
                  <span>📋</span>
                  <p>Orders</p>
                </div>
              )}
              {hasPrivilege('PAYMENT_PROCESS') && (
                <div className="quick-card">
                  <span>💳</span>
                  <p>Payments</p>
                </div>
              )}
              {hasPrivilege('STAFF_MANAGE') && (
                <div className="quick-card">
                  <span>👥</span>
                  <p>Staff</p>
                </div>
              )}
              {hasPrivilege('TABLE_MANAGE') && (
                <div className="quick-card">
                  <span>🪑</span>
                  <p>Tables</p>
                </div>
              )}
              {hasPrivilege('MENU_CREATE') && (
                <div className="quick-card">
                  <span>✏️</span>
                  <p>Manage Menu</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

