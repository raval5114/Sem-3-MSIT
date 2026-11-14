import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { type ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredNavigation?: string;
  requiredFeature?: string;
  requiredPermissions?: string[];
}

export default function ProtectedRoute({ children, requiredRole, requiredNavigation, requiredFeature, requiredPermissions = [] }: ProtectedRouteProps) {
  const {
    isAuthenticated,
    accessContext,
    accessLoading,
    accessError,
    logout,
    refreshAccessContext,
  } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (accessLoading) {
    return <div className="auth-page"><div className="auth-card" role="status">Loading your authorized workspace…</div></div>;
  }

  if (accessError || !accessContext) {
    return (
      <div className="auth-page">
        <div className="auth-card" role="alert">
          <div className="auth-logo" aria-hidden="true">!</div>
          <h2>Access could not be verified</h2>
          <p>{accessError || 'The access service did not return your current permissions.'}</p>
          <button className="auth-btn primary" onClick={() => void refreshAccessContext()}>Retry</button>
          <button className="auth-btn" onClick={logout}>Sign out</button>
        </div>
      </div>
    );
  }

  if (requiredRole && accessContext.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredNavigation && !accessContext.navigation.some((item) => item.featureKey === requiredNavigation)) {
    return <Navigate to="/unavailable" replace />;
  }

  if (requiredFeature && !accessContext.features[requiredFeature]?.enabled) {
    return <Navigate to="/unavailable" replace />;
  }

  if (requiredPermissions.some((permission) => !accessContext.permissions.includes(permission))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
