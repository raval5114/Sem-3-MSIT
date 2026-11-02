import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authService.login({ email, password });
      login(res.token, res.refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <header className="auth-site-header">
        <Link className="auth-site-brand" to="/login" aria-label="DineFlow home"><span className="auth-site-mark">d<span>.</span></span><span><strong>DineFlow</strong><small>RESTAURANT OS</small></span></Link>
        <p>Restaurant operations, made simple</p>
      </header>
      <main className="auth-main">
        <div className="auth-visual" aria-hidden="true"><span className="auth-orbit orbit-one" /><span className="auth-orbit orbit-two" /><span className="auth-visual-mark">d<span>.</span></span><p>Make every service<br />run a little smoother.</p><small>One workspace for your restaurant team.</small></div>
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">🍽️</div>
          <h1>DineFlow</h1>
          <p className="auth-subtitle">Staff Portal</p>
        </div>

        <p className="auth-kicker">STAFF PORTAL</p>
        <h2 className="auth-heading">Welcome back</h2>
        <p className="auth-description">Sign in to your account to continue</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@bistro.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button type="submit" className="auth-btn primary" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
      </main>
      <footer className="auth-site-footer"><span>© {new Date().getFullYear()} DineFlow</span><span>Thoughtful tools for better service</span><Link to="/register">Create a staff account <span aria-hidden="true">→</span></Link></footer>
    </div>
  );
}
