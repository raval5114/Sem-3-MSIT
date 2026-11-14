import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PlatformDashboardPage from './pages/PlatformDashboardPage';
import RestaurantRegistrationPage from './pages/RestaurantRegistrationPage';
import MenuPage from './pages/MenuPage';
import CustomerTableSessionPage from './pages/CustomerTableSessionPage';
import CustomerOrderingPage from './pages/CustomerOrderingPage';
import KdsPage from './pages/KdsPage';
import RoleOperationsPage from './pages/RoleOperationsPage';
import RestaurantAdminPage from './pages/RestaurantAdminPage';
import './auth.css';

function DashboardEntry() {
  const { accessContext } = useAuth();
  const canOpen = (featureKey: string, permissions: string[]) =>
    accessContext?.navigation.some((item) => item.featureKey === featureKey) &&
    permissions.every((permission) => accessContext.permissions.includes(permission));
  if (accessContext?.role === 'SUPER_ADMIN' && canOpen('PLATFORM_ADMIN', [])) return <Navigate to="/platform" replace />;
  if (['CHEF', 'KITCHEN_STAFF'].includes(accessContext?.role ?? '') && canOpen('KITCHEN_DISPLAY', ['ORDER_READ_ACTIVE'])) return <Navigate to="/kds" replace />;
  if (accessContext?.role === 'WAITER' && canOpen('WAITER_OPERATIONS', ['ORDER_CREATE', 'ORDER_READ_ACTIVE'])) return <Navigate to="/waiter" replace />;
  if (accessContext?.role === 'CASHIER' && canOpen('CASHIER_OPERATIONS', ['PAYMENT_PROCESS', 'ORDER_READ_ACTIVE'])) return <Navigate to="/payments" replace />;
  return <DashboardPage />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/r/:restaurantId/t/:tableId" element={<CustomerTableSessionPage />} />
          <Route path="/r/:restaurantId/t/:tableId/menu" element={<CustomerOrderingPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/restaurant-registration" replace />} />
          <Route path="/restaurant-registration" element={<RestaurantRegistrationPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN" requiredNavigation="PLATFORM_ADMIN">
                <PlatformDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/menu"
            element={
              <ProtectedRoute requiredFeature="MENU_MANAGEMENT" requiredPermissions={['MENU_READ']}>
                <MenuPage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin" element={<ProtectedRoute requiredRole="RESTAURANT_ADMIN" requiredPermissions={['STAFF_MANAGE']}><RestaurantAdminPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute requiredFeature="ORDER_MANAGEMENT" requiredPermissions={['ORDER_READ_ACTIVE']}><RoleOperationsPage workspace="orders" /></ProtectedRoute>} />
          <Route path="/waiter" element={<ProtectedRoute requiredFeature="WAITER_OPERATIONS" requiredPermissions={['ORDER_CREATE', 'ORDER_READ_ACTIVE']}><RoleOperationsPage workspace="waiter" /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute requiredFeature="CASHIER_OPERATIONS" requiredPermissions={['PAYMENT_PROCESS', 'ORDER_READ_ACTIVE']}><RoleOperationsPage workspace="cashier" /></ProtectedRoute>} />
          <Route path="/tables" element={<ProtectedRoute requiredFeature="TABLE_QR_MANAGEMENT" requiredPermissions={['TABLE_MANAGE']}><DashboardPage initialView="tables" /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute requiredFeature="ANALYTICS" requiredPermissions={['TABLE_REVENUE_READ']}><DashboardPage initialView="revenue" /></ProtectedRoute>} />
          <Route
            path="/kds"
            element={
              <ProtectedRoute requiredFeature="KITCHEN_DISPLAY" requiredPermissions={['ORDER_READ_ACTIVE']}>
                <KdsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/kitchen" element={<Navigate to="/kds" replace />} />
          <Route path="/unavailable" element={<div className="auth-page"><div className="auth-card" role="status"><div className="auth-logo" aria-hidden="true">⌁</div><h2>Feature unavailable</h2><p>This feature is not included in your current restaurant access. Contact your administrator if you believe this is incorrect.</p><a href="/dashboard" className="auth-btn primary">Return to dashboard</a></div></div>} />
          <Route
            path="/unauthorized"
            element={
              <div className="auth-page">
                <div className="auth-card">
                  <div className="auth-logo">🚫</div>
                  <h2>Access Denied</h2>
                  <p>You don't have the required role to view this page.</p>
                  <a href="/dashboard" className="auth-btn primary" style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none', textAlign: 'center' }}>
                    Go Back
                  </a>
                </div>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
