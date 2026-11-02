import { useState, type ReactNode } from 'react';
import type { UserSession } from '../../types/session';

export type DashboardView =
  | 'overview' | 'menu' | 'ingredients' | 'allergens' | 'food-intelligence'
  | 'orders' | 'kitchen' | 'tables' | 'revenue' | 'payments' | 'assistant' | 'simulation' | 'api-routes';

interface AppShellProps {
  user: UserSession;
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onLogout: () => void;
  children: ReactNode;
}

const navigation: { group: string; items: { id: DashboardView; label: string; icon: string; planned?: boolean }[] }[] = [
  { group: 'WORKSPACE', items: [{ id: 'overview', label: 'Overview', icon: '◫' }, { id: 'menu', label: 'Menu catalog', icon: '▤' }] },
  { group: 'FOOD INTELLIGENCE', items: [
    { id: 'ingredients', label: 'Ingredients', icon: '◉' },
    { id: 'allergens', label: 'Allergens & diets', icon: '⌘' },
    { id: 'food-intelligence', label: 'Food graph', icon: '⌬', planned: true },
  ] },
    { group: 'RESTAURANT OPERATIONS', items: [
    { id: 'orders', label: 'Orders', icon: '▣', planned: true },
    { id: 'kitchen', label: 'Kitchen display', icon: '◷', planned: true },
    { id: 'tables', label: 'Tables & QR', icon: '▦' },
    { id: 'revenue', label: 'Table revenue', icon: '↗' },
    { id: 'payments', label: 'Payments', icon: '＄', planned: true },
  ] },
  { group: 'INTELLIGENCE', items: [
    { id: 'assistant', label: 'DineFlow assistant', icon: '✳', planned: true },
    { id: 'simulation', label: 'What-if simulator', icon: '⌁', planned: true },
  ] },
];

export default function AppShell({ user, activeView, onNavigate, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const primaryRole = user.roles?.[0]?.replaceAll('_', ' ') ?? 'TEAM MEMBER';
  const initials = (user.email?.slice(0, 1) ?? 'D').toUpperCase();
  const canReadRevenue = user.roles?.includes('SUPER_ADMIN') || user.privileges?.includes('TABLE_REVENUE_READ');

  const navigate = (view: DashboardView) => {
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <div className="df-app">
      {mobileOpen && <button className="df-sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`df-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <button className="df-brand" onClick={() => navigate('overview')} aria-label="DineFlow home">
          <span className="df-brand-mark">d<span>.</span></span>
          <span><strong>dineflow</strong><small>RESTAURANT OS</small></span>
        </button>

        <div className="df-location-chip">
          <span className="df-location-dot" />
          <span><small>YOUR RESTAURANT</small><strong>{user.restaurantId || 'Guest session'}</strong></span>
          <span className="df-chevron">⌄</span>
        </div>

        <nav className="df-nav" aria-label="Dashboard navigation">
          {navigation.map((section) => (
            <div className="df-nav-section" key={section.group}>
              <p className="df-nav-label">{section.group}</p>
              {section.items.filter((item) => item.id !== 'revenue' || canReadRevenue).map((item) => (
                <button
                  key={item.id}
                  className={`df-nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                  aria-current={activeView === item.id ? 'page' : undefined}
                >
                  <span className="df-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.planned && <span className="df-nav-soon">SOON</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="df-sidebar-bottom">
          <button className={`df-nav-item ${activeView === 'api-routes' ? 'active' : ''}`} onClick={() => navigate('api-routes')}>
            <span className="df-nav-icon">⌘</span><span>API route map</span>
          </button>
          <div className="df-sidebar-help"><span>✦</span><div><strong>Need a hand?</strong><small>Visit the DineFlow guide</small></div><b>↗</b></div>
          <div className="df-profile">
            <span className="df-avatar">{initials}</span>
            <span className="df-profile-copy"><strong>{user.email || 'Restaurant guest'}</strong><small>{primaryRole}</small></span>
            <button className="df-logout" onClick={onLogout} title="Sign out" aria-label="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <div className="df-main-column">
        <header className="df-topbar">
          <button className="df-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
          <div className="df-breadcrumb"><span>Restaurant</span><b>/</b><strong>{navigation.flatMap((group) => group.items).find((item) => item.id === activeView)?.label ?? 'Dashboard'}</strong></div>
          <div className="df-top-actions">
            <div className="df-live-status"><span /> Menu workspace</div>
            <button className="df-icon-button" aria-label="Notifications">♧<i /></button>
            <span className="df-top-divider" />
            <span className="df-date-label">{new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span>
          </div>
        </header>
        <main className="df-page-content">{children}</main>
        <footer className="df-app-footer"><span>© {new Date().getFullYear()} DineFlow</span><span>Restaurant operations, thoughtfully connected</span><span>Restaurant workspace</span></footer>
      </div>
    </div>
  );
}
