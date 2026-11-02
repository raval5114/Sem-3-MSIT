import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

const ROLES = [
  'SUPER_ADMIN',
  'RESTAURANT_ADMIN',
  'CHEF',
  'WAITER',
  'CASHIER',
  'CUSTOMER_GUEST',
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleName: 'RESTAURANT_ADMIN',
    restaurantId: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const msg = await authService.register({
        name: form.name,
        email: form.email,
        password: form.password,
        roleName: form.roleName,
        restaurantId: form.restaurantId,
      });
      setSuccess(msg || 'User registered successfully!');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Registration failed. Please try again.');
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
      <main className="auth-main register-main">
        <div className="auth-visual" aria-hidden="true"><span className="auth-orbit orbit-one" /><span className="auth-orbit orbit-two" /><span className="auth-visual-mark">d<span>.</span></span><p>Good service starts<br />with a great team.</p><small>Bring your restaurant workspace together.</small></div>
      <div className="auth-card wide">
        <div className="auth-brand">
          <div className="auth-logo">🍽️</div>
          <h1>DineFlow</h1>
          <p className="auth-subtitle">Staff Portal</p>
        </div>

        <p className="auth-kicker">JOIN YOUR WORKSPACE</p>
        <h2 className="auth-heading">Create your account</h2>
        <p className="auth-description">Set up a staff profile to get started.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Hari Rawal"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="manager@bistro.com"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="roleName">Role</label>
              <select
                id="roleName"
                name="roleName"
                value={form.roleName}
                onChange={handleChange}
                required
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="restaurantId">Restaurant ID</label>
              <input
                id="restaurantId"
                name="restaurantId"
                type="text"
                value={form.restaurantId}
                onChange={handleChange}
                placeholder="rest_01h87z9k4m"
              />
            </div>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}
          {success && <div className="auth-success" role="status">{success}</div>}

          <button type="submit" className="auth-btn primary" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
      </main>
      <footer className="auth-site-footer"><span>© {new Date().getFullYear()} DineFlow</span><span>Thoughtful tools for better service</span><Link to="/login">Already a member? Sign in <span aria-hidden="true">→</span></Link></footer>
    </div>
  );
}
