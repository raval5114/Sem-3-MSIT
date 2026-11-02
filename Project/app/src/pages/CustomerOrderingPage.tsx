import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  customerOrderingService,
  type CustomerCategory,
  type CustomerModifierGroup,
  type CustomerProduct,
  type CustomerOrderLine,
  type PlacedOrder,
  type PaymentIntent,
} from '../services/customerOrderingService';
import '../customer-order.css';

interface TableSessionInfo { restaurantId: string; tableId: string; tableNumber: number; tableSessionId: string; expiresAt: string }
interface CartLine { key: string; product: CustomerProduct; quantity: number; line: CustomerOrderLine; unitPrice: number; optionsLabel: string }

function readTableSession(): TableSessionInfo | null {
  try { const raw = sessionStorage.getItem('customer_table_session'); return raw ? JSON.parse(raw) as TableSessionInfo : null; }
  catch { return null; }
}

function errorText(cause: unknown) {
  if (typeof cause === 'object' && cause !== null && 'response' in cause) {
    const response = (cause as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return cause instanceof Error ? cause.message : 'We could not complete this request.';
}

const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
function modifierPrompt(group: CustomerModifierGroup) {
  const minimum = group.required ? Math.max(1, group.minimumSelection) : group.minimumSelection;
  if (!group.required && !minimum) return `Choose up to ${group.maximumSelection}`;
  return minimum === group.maximumSelection ? `Choose ${minimum}` : `Choose ${minimum}–${group.maximumSelection}`;
}

export default function CustomerOrderingPage() {
  const { restaurantId, tableId } = useParams();
  const session = useMemo(() => readTableSession(), []);
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingProduct, setEditingProduct] = useState<CustomerProduct | null>(null);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'PAY_AT_COUNTER' | 'ONLINE'>('PAY_AT_COUNTER');
  const [onlineIntent, setOnlineIntent] = useState<{ order: PlacedOrder; intent: PaymentIntent } | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!restaurantId || !tableId || !session || session.restaurantId !== restaurantId || session.tableId !== tableId) {
        setError('Your table session is missing or does not match this QR. Scan the table QR again.'); setLoading(false); return;
      }
      try {
        const result = await customerOrderingService.getCatalog(restaurantId);
        if (active) { setCategories(result); setActiveCategory(result[0]?._id ?? ''); }
      } catch (cause) { if (active) setError(errorText(cause)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [restaurantId, tableId, session]);

  const addLine = (product: CustomerProduct, variantSelections: CustomerOrderLine['variantSelections'], modifierSelections: CustomerOrderLine['modifierSelections']) => {
    const selectedNames: string[] = [];
    let unitPrice = product.basePrice;
    for (const selection of variantSelections) {
      const group = product.variants.find((entry) => entry._id === selection.variantId);
      const option = group?.options.find((entry) => entry.optionId === selection.optionId);
      if (option) { unitPrice += option.priceAdjustment || 0; selectedNames.push(option.name); }
    }
    for (const selection of modifierSelections) {
      const group = product.modifierGroups.find((entry) => entry._id === selection.groupId);
      for (const optionId of selection.optionIds) {
        const option = group?.options.find((entry) => entry.optionId === optionId);
        if (option) { unitPrice += option.priceAdjustment || 0; selectedNames.push(option.name); }
      }
    }
    const key = `${product._id}:${JSON.stringify({ variantSelections, modifierSelections })}`;
    const line: CustomerOrderLine = { productId: product._id, quantity: 1, variantSelections, modifierSelections };
    setCart((current) => {
      const existing = current.find((entry) => entry.key === key);
      if (existing) return current.map((entry) => entry.key === key ? { ...entry, quantity: entry.quantity + 1, line: { ...entry.line, quantity: entry.quantity + 1 } } : entry);
      return [...current, { key, product, quantity: 1, line, unitPrice, optionsLabel: selectedNames.join(', ') }];
    });
  };

  const changeQuantity = (key: string, delta: number) => setCart((current) => current.flatMap((entry) => {
    if (entry.key !== key) return [entry];
    const quantity = entry.quantity + delta;
    return quantity < 1 ? [] : [{ ...entry, quantity, line: { ...entry.line, quantity } }];
  }));

  const placeOrder = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setPlacing(true);
    try {
      if (paymentMethod === 'PAY_AT_COUNTER') {
        const result = await customerOrderingService.placeOrder(cart.map((entry) => entry.line), 'PAY_AT_COUNTER');
        setOrder(result); setCart([]);
      } else {
        const placed = await customerOrderingService.placeOrder(cart.map((entry) => entry.line), 'ONLINE');
        const intent = await customerOrderingService.createPaymentIntent(placed.id);
        setOnlineIntent({ order: placed, intent });
      }
    } catch (cause) { setError(errorText(cause)); }
    finally { setPlacing(false); }
  };

  const completeOnlinePayment = async () => {
    if (!onlineIntent) return;
    setProcessingPayment(true); setError('');
    try {
      const mockPaymentId = `pay_sbx_${Math.random().toString(36).substring(2, 10)}`;
      const mockSignature = `sbx_sig_${Math.random().toString(36).substring(2, 12)}`;
      const verified = await customerOrderingService.verifyPayment({
        orderId: onlineIntent.order.id,
        paymentId: onlineIntent.intent.paymentId,
        providerPaymentId: mockPaymentId,
        providerOrderId: onlineIntent.intent.providerOrderId,
        signature: mockSignature,
      });
      setOrder({
        ...onlineIntent.order,
        status: verified.orderStatus,
        paymentStatus: verified.status,
      });
      setOnlineIntent(null);
      setCart([]);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setProcessingPayment(false);
    }
  };

  useEffect(() => {
    if (!order) return;
    const interval = setInterval(async () => {
      try {
        const latest = await customerOrderingService.getOrderStatus(order.id);
        if (latest.status !== order.status || latest.paymentStatus !== order.paymentStatus) {
          setOrder((prev) => prev ? { ...prev, status: latest.status, paymentStatus: latest.paymentStatus } : null);
        }
      } catch {
        // Non-blocking poll catch-up
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [order?.id, order?.status, order?.paymentStatus]);

  if (!session || session.restaurantId !== restaurantId || session.tableId !== tableId) return <main className="df-order-page"><section className="df-order-notice"><span className="df-order-brand">d<span>.</span></span><h1>Reconnect to your table</h1><p>{error || 'Scan the QR code on your table to start a customer session.'}</p><Link className="df-order-button" to={`/r/${restaurantId}/t/${tableId}`}>Scan QR again</Link></section></main>;

  if (order) {
    const STAGE_LABELS: Record<string, string> = {
      SUBMITTED: 'Received',
      PAYMENT_PENDING: 'Payment Pending',
      PENDING_KITCHEN: 'Sent to Kitchen',
      ACCEPTED: 'Accepted by Kitchen',
      PREPARING: 'Cooking in Progress',
      READY: 'Plated & Ready',
      SERVED: 'Served to Table',
      COMPLETED: 'Session Completed',
      CANCELLED: 'Cancelled',
    };
    const orderIndex = ['SUBMITTED', 'PENDING_KITCHEN', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].indexOf(order.status);

    return (
      <main className="df-order-page">
        <section className="df-order-confirmation">
          <span className="df-order-brand">d<span>.</span></span>
          <span className="df-order-status" style={{ background: order.status === 'READY' ? '#dcfce7' : order.status === 'PREPARING' ? '#fef3c7' : '#edf6ef', color: order.status === 'READY' ? '#15803d' : order.status === 'PREPARING' ? '#b45309' : '#46835a' }}>
            ● {STAGE_LABELS[order.status] || order.status}
          </span>
          <h1>{order.status === 'READY' ? 'Food is ready!' : order.status === 'PREPARING' ? 'Kitchen is cooking' : order.paymentStatus === 'PAID' ? 'Payment confirmed!' : 'Order received'}</h1>
          <p>{order.paymentStatus === 'PAID' ? 'Your payment is confirmed. Follow live progress below.' : 'Show this order number to staff when paying at the counter.'}</p>
          <div className="df-order-number">#{order.id.slice(0, 8).toUpperCase()}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', margin: '20px 0' }}>
            {[
              { id: 'ACCEPTED', label: 'Accepted' },
              { id: 'PREPARING', label: 'Cooking' },
              { id: 'READY', label: 'Ready' },
              { id: 'SERVED', label: 'Served' },
            ].map((step) => {
              const stepIndex = ['SUBMITTED', 'PENDING_KITCHEN', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].indexOf(step.id);
              const isPast = orderIndex >= stepIndex;
              const isCurrent = order.status === step.id;
              return (
                <div key={step.id} style={{ padding: '8px 4px', borderRadius: '8px', background: isCurrent ? '#dcfce7' : isPast ? '#edf6ef' : '#f5f7f5', border: isCurrent ? '2px solid #22c55e' : '1px solid #e2e8e2', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: isCurrent ? 800 : 600, color: isPast ? '#166534' : '#9ca3af' }}>{step.label}</div>
                </div>
              );
            })}
          </div>

          <div className="df-order-total">
            <span>{order.paymentStatus === 'PAID' ? 'Total paid online' : 'Total due at counter'}</span>
            <strong>{money(order.total)}</strong>
          </div>
          <ul>
            {order.items.map((item, index) => (
              <li key={item.id ?? index}>
                <span>{item.quantity} × {item.name}</span>
                <strong>{money(item.lineTotal)}</strong>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="df-order-button secondary full"
              onClick={async () => {
                try {
                  const latest = await customerOrderingService.getOrderStatus(order.id);
                  setOrder((prev) => prev ? { ...prev, status: latest.status, paymentStatus: latest.paymentStatus } : null);
                } catch (err) {
                  setError(errorText(err));
                }
              }}
            >
              ↻ Refresh Live Status
            </button>
            <Link className="df-order-button full" to={`/r/${restaurantId}/t/${tableId}/menu`}>
              Back to menu
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const visibleCategories = categories.filter((category) => category.products.length > 0);
  const selectedCategory = visibleCategories.find((category) => category._id === activeCategory) ?? visibleCategories[0];
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  return <main className="df-order-page">
    <header className="df-order-header"><Link to={`/r/${restaurantId}/t/${tableId}`} className="df-order-brand">d<span>.</span></Link><div><span>TABLE {session.tableNumber}</span><small>QR ORDERING</small></div><span className="df-order-session-dot">Session active</span></header>
    <div className="df-order-layout">
      <section className="df-menu-column"><div className="df-menu-welcome"><p className="df-order-eyebrow">MADE FRESH FOR YOU</p><h1>Explore the menu</h1><p>Choose your favorites and we’ll prepare them for your table.</p></div>
        {error && <div className="df-order-error" role="alert">{error}</div>}
        {loading ? <div className="df-order-empty">Loading the menu…</div> : visibleCategories.length === 0 ? <div className="df-order-empty">The menu is currently unavailable. Please ask staff for help.</div> : <>
          <nav className="df-menu-categories" aria-label="Menu categories">{visibleCategories.map((category) => <button key={category._id} className={selectedCategory?._id === category._id ? 'active' : ''} onClick={() => setActiveCategory(category._id)}>{category.name}</button>)}</nav>
          <div className="df-customer-product-list">{selectedCategory?.products.map((product) => <article className="df-customer-product" key={product._id}>
            {product.imageUrl && <img src={product.imageUrl} alt="" loading="lazy" />}
            <div className="df-customer-product-copy"><div className="df-customer-product-title"><h2>{product.name}</h2><strong>{money(product.basePrice)}</strong></div><p>{product.description || 'Prepared fresh by our kitchen.'}</p><div className="df-customer-product-meta">{product.preparationTimeMinutes ? <span>{product.preparationTimeMinutes} min</span> : null}{product.dietaryTags?.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <button className="df-order-add" onClick={() => (product.variants.length || product.modifierGroups.length) ? setEditingProduct(product) : addLine(product, [], [])}>＋ Add to order</button>
            </div>
          </article>)}</div>
        </>}
      </section>
      <aside className="df-cart-panel"><div className="df-cart-heading"><div><p className="df-order-eyebrow">YOUR SELECTION</p><h2>Your order <span>{itemCount}</span></h2></div></div>
        {cart.length === 0 ? <div className="df-cart-empty">Your cart is empty.<br />Add a menu item to get started.</div> : <>
          <div className="df-cart-lines">{cart.map((line) => <div className="df-cart-line" key={line.key}><div><strong>{line.product.name}</strong>{line.optionsLabel && <small>{line.optionsLabel}</small>}<b>{money(line.unitPrice * line.quantity)}</b></div><div className="df-quantity-control"><button aria-label={`Remove one ${line.product.name}`} onClick={() => changeQuantity(line.key, -1)}>−</button><span>{line.quantity}</span><button aria-label={`Add one ${line.product.name}`} disabled={line.quantity >= 99} onClick={() => changeQuantity(line.key, 1)}>＋</button></div></div>)}</div>
          <form className="df-cart-checkout" onSubmit={placeOrder}>
            <p className="df-order-eyebrow">PAYMENT METHOD</p>
            <label className={`df-payment-choice ${paymentMethod === 'PAY_AT_COUNTER' ? 'selected' : ''}`} onClick={() => setPaymentMethod('PAY_AT_COUNTER')}>
              <input type="radio" name="paymentMethod" checked={paymentMethod === 'PAY_AT_COUNTER'} onChange={() => setPaymentMethod('PAY_AT_COUNTER')} />
              <span><strong>Pay at counter</strong><small>Pay staff when your order is served</small></span>
            </label>
            <label className={`df-payment-choice ${paymentMethod === 'ONLINE' ? 'selected' : ''}`} onClick={() => setPaymentMethod('ONLINE')}>
              <input type="radio" name="paymentMethod" checked={paymentMethod === 'ONLINE'} onChange={() => setPaymentMethod('ONLINE')} />
              <span><strong>Online payment</strong><small>Instant UPI, Cards & NetBanking</small></span>
            </label>
            <div className="df-cart-subtotal"><span>Subtotal</span><strong>{money(cartTotal)}</strong></div>
            <p className="df-cart-price-note">Final total is confirmed by the server at checkout.</p>
            <button className="df-order-button full" disabled={placing || itemCount === 0}>
              {placing ? 'Placing order…' : paymentMethod === 'ONLINE' ? `Proceed to Pay · ${money(cartTotal)}` : `Place order · ${money(cartTotal)}`}
            </button>
          </form>
        </>}
      </aside>
    </div>
    {onlineIntent && (
      <div className="df-order-modal-backdrop" role="presentation">
        <section className="df-order-modal" role="dialog" aria-modal="true" aria-labelledby="df-payment-title">
          <div className="df-customize-heading">
            <div>
              <p className="df-order-eyebrow">SECURE CHECKOUT</p>
              <h2 id="df-payment-title">Online Payment</h2>
              <span>DineFlow Instant Gateway ({onlineIntent.intent.provider})</span>
            </div>
            <button className="df-modal-close" onClick={() => setOnlineIntent(null)} aria-label="Cancel payment">×</button>
          </div>
          <div style={{ margin: '18px 0', padding: '16px', background: '#f7fbf7', border: '1px solid #cce0d0', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', color: '#4c594e' }}>
              <span>Order Reference</span>
              <strong>#{onlineIntent.order.id.slice(0, 8).toUpperCase()}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: '#3d8057' }}>
              <span>Amount Payable</span>
              <span>{money(onlineIntent.intent.amount)}</span>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#7a857b', marginBottom: '18px', lineHeight: 1.6 }}>
            Supports UPI (Google Pay, PhonePe, Paytm), Visa/Mastercard/RuPay credit & debit cards, and net banking.
          </div>
          <div className="df-customize-actions">
            <button className="df-order-button secondary" onClick={() => setOnlineIntent(null)} disabled={processingPayment}>Cancel</button>
            <button className="df-order-button" onClick={completeOnlinePayment} disabled={processingPayment}>
              {processingPayment ? 'Confirming payment…' : `Pay ${money(onlineIntent.intent.amount)}`}
            </button>
          </div>
        </section>
      </div>
    )}
    {editingProduct && <CustomizeDialog product={editingProduct} onCancel={() => setEditingProduct(null)} onAdd={(variants, modifiers) => { addLine(editingProduct, variants, modifiers); setEditingProduct(null); }} />}
  </main>;
}

function CustomizeDialog({ product, onCancel, onAdd }: { product: CustomerProduct; onCancel: () => void; onAdd: (variants: CustomerOrderLine['variantSelections'], modifiers: CustomerOrderLine['modifierSelections']) => void }) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const toggle = (key: string, optionId: string, single: boolean) => setSelections((current) => {
    const old = current[key] || [];
    return { ...current, [key]: single ? (old[0] === optionId ? [] : [optionId]) : old.includes(optionId) ? old.filter((id) => id !== optionId) : [...old, optionId] };
  });
  const variants = product.variants.filter((variant) => variant.isActive);
  const groups = product.modifierGroups.filter((group) => group.isActive);
  const modifierInvalid = groups.some((group) => {
    const count = (selections[`modifier:${group._id}`] || []).length;
    const minimum = group.required ? Math.max(1, group.minimumSelection || 0) : (group.minimumSelection || 0);
    return count < minimum || count > group.maximumSelection;
  });
  return <div className="df-order-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="df-order-modal" role="dialog" aria-modal="true" aria-labelledby="df-customize-title">
    <div className="df-customize-heading"><div><p className="df-order-eyebrow">MAKE IT YOURS</p><h2 id="df-customize-title">{product.name}</h2><span>Starting at {money(product.basePrice)}</span></div><button className="df-modal-close" onClick={onCancel} aria-label="Close customizations">×</button></div>
    {variants.map((variant) => <fieldset className="df-option-group" key={variant._id}><legend>{variant.name} <small>Optional</small></legend>{variant.options.filter((option) => option.isAvailable !== false).map((option) => <label className="df-option-row" key={option.optionId}><input type="radio" name={`variant-${variant._id}`} checked={(selections[`variant:${variant._id}`] || [])[0] === option.optionId} onChange={() => toggle(`variant:${variant._id}`, option.optionId, true)} /><span>{option.name}</span><small>{option.priceAdjustment ? `+${money(option.priceAdjustment)}` : ''}</small></label>)}</fieldset>)}
    {groups.map((group: CustomerModifierGroup) => <fieldset className="df-option-group" key={group._id}><legend>{group.name} <small>{modifierPrompt(group)}</small></legend>{group.options.filter((option) => option.isAvailable !== false).map((option) => { const selected = (selections[`modifier:${group._id}`] || []).includes(option.optionId); const atLimit = (selections[`modifier:${group._id}`] || []).length >= group.maximumSelection; return <label className="df-option-row" key={option.optionId}><input type={group.maximumSelection === 1 ? 'radio' : 'checkbox'} name={`modifier-${group._id}`} checked={selected} disabled={group.maximumSelection > 1 && atLimit && !selected} onChange={() => toggle(`modifier:${group._id}`, option.optionId, group.maximumSelection === 1)} /><span>{option.name}</span><small>{option.priceAdjustment ? `+${money(option.priceAdjustment)}` : ''}</small></label>; })}</fieldset>)}
    <div className="df-customize-actions"><button className="df-order-button secondary" onClick={onCancel}>Cancel</button><button className="df-order-button" disabled={modifierInvalid} onClick={() => onAdd(variants.flatMap((variant) => (selections[`variant:${variant._id}`] || []).map((optionId) => ({ variantId: variant._id, optionId }))), groups.flatMap((group) => { const optionIds = selections[`modifier:${group._id}`] || []; return optionIds.length ? [{ groupId: group._id, optionIds }] : []; }))}>Add item · {money(product.basePrice)}</button></div>
  </section></div>;
}
