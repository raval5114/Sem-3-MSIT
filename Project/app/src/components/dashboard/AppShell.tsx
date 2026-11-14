import { useState, type ReactNode } from 'react';
import type { UserSession } from '../../types/session';
import { useAuth } from '../../context/AuthContext';
import ButlerChatPanel from '../butler/ButlerChatPanel';

export type DashboardView =
  | 'overview' | 'menu' | 'ingredients' | 'allergens' | 'food-intelligence'
  | 'orders' | 'kitchen' | 'waiter' | 'tables' | 'revenue' | 'payments' | 'admin' | 'assistant' | 'simulation' | 'api-routes';

interface AppShellProps {
  user: UserSession;
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onLogout: () => void;
  children: ReactNode;
}

const viewByFeature: Record<string, { id: DashboardView; icon: string; group: string; permissions: string[] }> = {
  MENU_MANAGEMENT: { id: 'menu', icon: '▤', group: 'WORKSPACE', permissions: ['MENU_READ'] },
  ORDER_MANAGEMENT: { id: 'orders', icon: '▣', group: 'RESTAURANT OPERATIONS', permissions: ['ORDER_READ_ACTIVE'] },
  KITCHEN_DISPLAY: { id: 'kitchen', icon: '◷', group: 'RESTAURANT OPERATIONS', permissions: ['ORDER_READ_ACTIVE'] },
  WAITER_OPERATIONS: { id: 'waiter', icon: '♧', group: 'RESTAURANT OPERATIONS', permissions: ['ORDER_CREATE', 'ORDER_READ_ACTIVE'] },
  TABLE_QR_MANAGEMENT: { id: 'tables', icon: '▦', group: 'RESTAURANT OPERATIONS', permissions: ['TABLE_MANAGE'] },
  CASHIER_OPERATIONS: { id: 'payments', icon: '＄', group: 'RESTAURANT OPERATIONS', permissions: ['PAYMENT_PROCESS', 'ORDER_READ_ACTIVE'] },
  ANALYTICS: { id: 'revenue', icon: '↗', group: 'RESTAURANT ANALYTICS', permissions: ['TABLE_REVENUE_READ'] },
  BUTLER_AI_ASSISTANT: { id: 'assistant', icon: '✦', group: 'INTELLIGENCE', permissions: [] },
};
export default function AppShell({ user, activeView, onNavigate, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [butlerOpen, setButlerOpen] = useState(false);
  const { accessContext, accessLoading, accessError, refreshAccessContext } = useAuth();
  const role = accessContext?.role ?? 'TEAM MEMBER';
  const primaryRole = role.replaceAll('_', ' ');
  const email = accessContext?.email ?? user.email ?? 'Restaurant team member';
  const restaurantIdentity = accessContext?.restaurantName || accessContext?.restaurantId || 'Restaurant workspace';
  const initials = email.slice(0, 1).toUpperCase();
  const butlerEnabled = Boolean(
    accessContext && (
      accessContext.navigation.some((item) => item.featureKey === 'BUTLER_AI_ASSISTANT')
      || accessContext.features['BUTLER_AI_ASSISTANT']?.enabled
      || accessContext.features.butler_ai_assistant?.enabled
    )
  );

  const availableItems = (accessContext?.navigation ?? [])
    .map((item) => {
      const metadata = viewByFeature[item.featureKey];
      const permissionsGranted = metadata?.permissions.every((permission) => accessContext?.permissions.includes(permission));
      return metadata && permissionsGranted
        ? { id: metadata.id, icon: metadata.icon, group: metadata.group, label: item.label }
        : null;
    })
    .filter((item): item is { id: DashboardView; icon: string; group: string; label: string } => item !== null);

  const butlerNavigationItem = butlerEnabled ? { id: 'assistant' as const, icon: '✦', group: 'INTELLIGENCE', label: 'Butler' } : null;
  const sections = [
    { group: 'WORKSPACE', items: [
      { id: 'overview' as const, label: 'Overview', icon: '◫' },
      ...(role === 'RESTAURANT_ADMIN' && accessContext?.permissions.includes('STAFF_MANAGE')
        ? [{ id: 'admin' as const, label: 'Administration', icon: '⚙' }]
        : []),
      ...(butlerNavigationItem ? [butlerNavigationItem] : []),
    ] },
    ...Array.from(new Set(availableItems.map((item) => item.group))).map((group) => ({
      group,
      items: availableItems.filter((item) => item.group === group),
    })),
  ];
  const activeLabel = activeView === 'overview'
    ? 'Overview'
    : activeView === 'admin'
      ? 'Administration'
      : activeView === 'assistant'
        ? 'Butler'
        : availableItems.find((item) => item.id === activeView)?.label ?? 'Dashboard';

  const navigate = (view: DashboardView) => {
    void refreshAccessContext();
    if (view === 'assistant') {
      setButlerOpen(true);
    } else {
      setButlerOpen(false);
    }
    onNavigate(view);
    setMobileOpen(false);
  };

  return (
    <div className="df-app">
      {mobileOpen && <button className="df-sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`df-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <button className="df-brand" onClick={() => navigate('overview')} aria-label="DineFlow home">
          <span className="df-brand-mark">d<span>.</span></span>
          <span><strong>DineFlow</strong><small>RESTAURANT WORKSPACE</small></span>
        </button>

        <div className="df-location-chip">
          <span className="df-location-dot" />
          <span><small>AUTHORIZED RESTAURANT</small><strong>{restaurantIdentity}</strong></span>
          <span className="df-chevron" aria-hidden="true">⌄</span>
        </div>

        <nav className="df-nav" aria-label="Dashboard navigation">
          {sections.map((section) => (
            <div className="df-nav-section" key={section.group}>
              <p className="df-nav-label">{section.group}</p>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`df-nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                  aria-current={activeView === item.id ? 'page' : undefined}
                >
                  <span className="df-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
          {!accessLoading && !accessError && availableItems.length === 0 && (
            <p className="df-nav-empty">No restaurant modules are currently available.</p>
          )}
        </nav>

        <div className="df-sidebar-bottom">
          <div className="df-profile">
            <span className="df-avatar">{initials}</span>
            <span className="df-profile-copy"><strong>{accessContext?.displayName || email}</strong><small>{primaryRole}</small></span>
            <button className="df-logout" onClick={onLogout} title="Sign out" aria-label="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <div className="df-main-column">
        <header className="df-topbar">
          <button className="df-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
          <div className="df-breadcrumb"><span>{restaurantIdentity}</span><b>/</b><strong>{activeLabel}</strong></div>
          <div className="df-top-actions">
            <div className="df-live-status"><span /> {primaryRole}</div>
            {butlerEnabled && (
              <button
                type="button"
                className={`df-butler-launcher ${butlerOpen ? 'active' : ''}`}
                onClick={() => { setButlerOpen((current) => !current); if (activeView !== 'assistant') onNavigate('assistant'); }}
                aria-label="Open Butler assistant"
                title="Open Butler assistant"
              >
                ✦ Butler
              </button>
            )}
            <button
              className="df-icon-button"
              aria-label="Refresh access"
              title={accessError || 'Refresh permissions'}
              disabled={accessLoading}
              onClick={() => void refreshAccessContext()}
            >↻</button>
            <span className="df-top-divider" />
            <span className="df-date-label">{new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span>
          </div>
        </header>
        {accessError && <div className="df-access-warning" role="alert">Your latest permissions could not be refreshed: {accessError}</div>}
        <main className="df-page-content">{children}</main>
        {(butlerEnabled && (butlerOpen || activeView === 'assistant')) && (
          <ButlerChatPanel
            restaurantId={accessContext?.restaurantId ?? undefined}
            open={butlerOpen || activeView === 'assistant'}
            onClose={() => { setButlerOpen(false); if (activeView === 'assistant') onNavigate('overview'); }}
          />
        )}
        <footer className="df-app-footer"><span>© {new Date().getFullYear()} DineFlow</span><span>Restaurant operations, thoughtfully connected</span><span>{restaurantIdentity}</span></footer>
      </div>
    </div>
  );
}
