import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authService, type RestaurantRegistration } from '../services/authService';
import '../platform-dashboard.css';

export default function RestaurantRegistrationPage() {
  const [form, setForm] = useState({
    restaurantName: '',
    ownerName: '',
    ownerEmail: '',
    phone: '',
    address: '',
  });
  const [submission, setSubmission] = useState<RestaurantRegistration | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmission(null);
    setLoading(true);
    try {
      setSubmission(await authService.submitRestaurantRegistration(form));
    } catch (cause) {
      const responseMessage = (cause as { response?: { data?: { message?: string; detail?: string } } })
        ?.response?.data;
      setError(responseMessage?.message ?? responseMessage?.detail ?? 'We could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="df-platform-public">
      <header className="df-platform-public-header">
        <Link to="/login" className="df-platform-wordmark"><span>d.</span> DineFlow</Link>
        <Link to="/login">Staff sign in <span aria-hidden="true">→</span></Link>
      </header>
      <main className="df-platform-public-main">
        <section className="df-platform-public-intro">
          <p className="df-platform-eyebrow">RESTAURANT ONBOARDING</p>
          <h1>Bring your restaurant onto DineFlow.</h1>
          <p>Tell us a little about your restaurant. Our platform team will review your application and follow up with the owner contact.</p>
          <div className="df-platform-review-note"><span>✓</span><p><strong>Reviewed by our team</strong><br />A Restaurant ID is issued only after approval.</p></div>
        </section>
        <section className="df-platform-form-card">
          {submission ? (
            <div className="df-platform-submit-success" role="status">
              <span className="df-platform-success-mark">✓</span>
              <p className="df-platform-eyebrow">APPLICATION RECEIVED</p>
              <h2>Thank you, {submission.ownerName}.</h2>
              <p><strong>{submission.restaurantName}</strong> is now pending review. We’ll contact you at {submission.ownerEmail}.</p>
              <p className="df-platform-reference">Reference: {submission.id}</p>
              <Link to="/login" className="df-platform-button secondary">Back to sign in</Link>
            </div>
          ) : (
            <>
              <div className="df-platform-form-heading"><p className="df-platform-eyebrow">GET STARTED</p><h2>Restaurant details</h2><p>All fields marked required must be provided.</p></div>
              <form className="df-platform-form" onSubmit={submit}>
                <label>Restaurant name<input name="restaurantName" value={form.restaurantName} onChange={update} maxLength={200} required autoComplete="organization" /></label>
                <label>Owner / primary contact<input name="ownerName" value={form.ownerName} onChange={update} maxLength={200} required autoComplete="name" /></label>
                <label>Contact email<input name="ownerEmail" type="email" value={form.ownerEmail} onChange={update} maxLength={320} required autoComplete="email" /></label>
                <label>Phone <span className="df-platform-optional">OPTIONAL</span><input name="phone" type="tel" value={form.phone} onChange={update} maxLength={50} autoComplete="tel" /></label>
                <label>Restaurant address <span className="df-platform-optional">OPTIONAL</span><textarea name="address" value={form.address} onChange={update} maxLength={10000} rows={3} autoComplete="street-address" /></label>
                {error && <div className="df-platform-alert error" role="alert">{error}</div>}
                <button className="df-platform-button primary" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit application'}<span aria-hidden="true">→</span></button>
                <p className="df-platform-form-footnote">Submitting this form does not create an account or activate a subscription.</p>
              </form>
            </>
          )}
        </section>
      </main>
      <footer className="df-platform-public-footer"><span>© {new Date().getFullYear()} DineFlow</span><span>Thoughtful tools for better service</span></footer>
    </div>
  );
}
