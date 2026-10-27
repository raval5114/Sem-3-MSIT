import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import './auth.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
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
