import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell, { type DashboardView } from '../components/dashboard/AppShell';
import PageHeader from '../components/dashboard/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { useMenuCatalog } from '../hooks/useMenuCatalog';
import { apiRouteCatalog, menuService, type Allergen, type Category, type Ingredient, type Product } from '../services/menuService';
import { tableService, type RestaurantTable, type TableQrResponse, type TableRequest, type TableStatus } from '../services/tableService';
import TableRevenueAnalytics from './TableRevenueAnalytics';
import '../dashboard.css';

type Tab = 'products' | 'categories';
const viewCopy: Record<DashboardView, [string, string, string]> = {
  overview: ['YOUR RESTAURANT AT A GLANCE', 'Good service starts here.', 'A clear view of your menu setup and restaurant operations.'],
  menu: ['MENU MANAGEMENT', 'Your menu, in one place.', 'Organize categories and keep every menu item accurate and available.'],
  ingredients: ['FOOD INTELLIGENCE', 'Ingredient library.', 'Manage the ingredients that power recipes and food profiles.'],
  allergens: ['FOOD INTELLIGENCE', 'Allergen directory.', 'Maintain allergen reference data for accurate guest information.'],
  'food-intelligence': ['FOOD INTELLIGENCE', 'Food graph.', 'Connect ingredients, recipes, dietary properties, and allergens.'],
  orders: ['RESTAURANT OPERATIONS', 'Orders.', 'Follow incoming orders from placement through fulfilment.'],
  kitchen: ['RESTAURANT OPERATIONS', 'Kitchen display.', 'Keep preparation work moving with a live kitchen queue.'],
  tables: ['RESTAURANT OPERATIONS', 'Tables & QR.', 'Give guests a simple path from their table to your menu.'],
  revenue: ['RESTAURANT ANALYTICS', 'Revenue by table.', 'Review settled sales and refunds for your restaurant tables.'],
  payments: ['RESTAURANT OPERATIONS', 'Payments.', 'Track payment status and guest receipts.'],
  assistant: ['INTELLIGENCE', 'DineFlow assistant.', 'Restaurant insights and assistance, in one place.'],
  simulation: ['INTELLIGENCE', 'What-if simulator.', 'Explore menu changes and their expected impact.'],
  'api-routes': ['DEVELOPER TOOLS', 'API route map.', 'See which frontend workflows are backed by live service endpoints.'],
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<DashboardView>('overview');
  const { categories, products, loading, error, refresh, createCategory, createProduct, setAvailability, setStatus, deleteProduct, deleteCategory } = useMenuCatalog(user?.restaurantId);
  const [tab, setTab] = useState<Tab>('products');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState('');
  const [resourceForm, setResourceForm] = useState(false);

  const activeProducts = products.filter((product) => product.status === 'ACTIVE');
  const availableProducts = products.filter((product) => product.isAvailable);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category._id, category.name])), [categories]);

  const navigateTo = (next: DashboardView) => {
    if (next === 'menu') { navigate('/menu'); return; }
    setView(next); setNotice(''); setResourceError(''); setResourceForm(false);
    if (next === 'ingredients' || next === 'allergens') void loadResources(next);
  };
  async function loadResources(target: 'ingredients' | 'allergens' = view as 'ingredients' | 'allergens') {
    setResourceLoading(true); setResourceError('');
    try {
      if (target === 'ingredients') setIngredients(await menuService.ingredients.list({ restaurantId: user?.restaurantId }));
      else setAllergens(await menuService.allergens.list());
    } catch (cause) { setResourceError(cause instanceof Error ? cause.message : 'Could not load data.'); }
    finally { setResourceLoading(false); }
  }
  const withAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setNotice('');
    try { await action(); setNotice(success); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : 'The request could not be completed.'); }
    finally { setBusy(false); }
  };
  const handleLogout = () => { logout(); navigate('/login'); };
  const [eyebrow, title, description] = viewCopy[view];

  return <AppShell user={user ?? {}} activeView={view} onNavigate={navigateTo} onLogout={handleLogout}>
    {view === 'overview' && <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={{ label: 'Manage menu', onClick: () => navigateTo('menu') }} />
      {error && <div className="df-alert error"><strong>Menu service unavailable</strong><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div>}
      {!error && !user?.restaurantId && <div className="df-alert warning"><strong>Restaurant scope is missing</strong><span>Sign in with a restaurant account to load restaurant data.</span></div>}
      <div className="df-stat-grid">
        <StatCard label="Menu items" value={loading ? '…' : products.length} detail={`${activeProducts.length} active`} icon="▤" />
        <StatCard label="Available now" value={loading ? '…' : availableProducts.length} detail="Items guests can order" icon="✓" tone="green" />
        <StatCard label="Categories" value={loading ? '…' : categories.length} detail="Menu sections" icon="▦" tone="purple" />
        <StatCard label="Orders today" value="—" detail="Orders API not connected" icon="↗" tone="blue" />
      </div>
      <section className="df-panel df-overview-panel">
        <div className="df-panel-heading"><div><p className="df-eyebrow">MENU SNAPSHOT</p><h2>Recently updated menu items</h2></div><button className="df-text-button" onClick={() => navigateTo('menu')}>Open catalog ↗</button></div>
        {loading ? <div className="df-empty">Loading restaurant menu…</div> : products.length ? <div className="df-table-wrap"><table className="df-table"><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Availability</th></tr></thead><tbody>{products.slice(0, 5).map((product) => <tr key={product._id}><td><strong>{product.name}</strong><small>{product.description || 'No description'}</small></td><td>{categoryById.get(product.categoryId) ?? 'Uncategorized'}</td><td>{formatPrice(product.basePrice)}</td><td><span className={`df-pill ${product.isAvailable ? 'success' : 'muted'}`}>{product.isAvailable ? 'Available' : 'Unavailable'}</span></td></tr>)}</tbody></table></div> : <div className="df-empty"><span>☷</span><strong>Your menu is ready to take shape</strong><p>Add a category and your first item to get started.</p><button className="df-button df-button-primary" onClick={() => navigateTo('menu')}>Set up menu</button></div>}
      </section>
      <section className="df-quick-grid">
        <button onClick={() => navigateTo('menu')}><span className="df-quick-icon orange">＋</span><strong>Add menu item</strong><small>Create products and categories</small><b>↗</b></button>
        <button onClick={() => window.location.href = '/kds'}><span className="df-quick-icon orange">🍳</span><strong>Kitchen KDS</strong><small>Live tickets & station orders</small><b>↗</b></button>
        <button onClick={() => navigateTo('ingredients')}><span className="df-quick-icon green">◉</span><strong>Update ingredients</strong><small>Maintain food reference data</small><b>↗</b></button>
        <button onClick={() => navigateTo('api-routes')}><span className="df-quick-icon purple">⌘</span><strong>Explore API coverage</strong><small>See live and planned routes</small><b>↗</b></button>
      </section>
    </>}

    {view === 'menu' && <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={{ label: tab === 'products' ? 'Add menu item' : 'Add category', onClick: () => setShowForm(true) }} />
      {error && <div className="df-alert error"><strong>Could not load menu</strong><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div>}
      {notice && <div className={`df-alert ${notice.toLowerCase().includes('could not') || notice.toLowerCase().includes('failed') ? 'error' : 'success'}`}>{notice}</div>}
      <section className="df-panel">
        <div className="df-panel-heading"><div className="df-tabs"><button className={tab === 'products' ? 'selected' : ''} onClick={() => { setTab('products'); setShowForm(false); }}>Menu items <span>{products.length}</span></button><button className={tab === 'categories' ? 'selected' : ''} onClick={() => { setTab('categories'); setShowForm(false); }}>Categories <span>{categories.length}</span></button></div><button className="df-icon-button" onClick={() => void refresh()} aria-label="Refresh menu">↻</button></div>
        {showForm && <CatalogForm kind={tab} categories={categories} onCancel={() => setShowForm(false)} onSubmit={(payload) => withAction(async () => { if (tab === 'categories') await createCategory(payload as Partial<Category>); else await createProduct(payload as Partial<Product>); setShowForm(false); }, `${tab === 'categories' ? 'Category' : 'Menu item'} created.`)} />}
        {loading ? <div className="df-empty">Loading menu catalog…</div> : tab === 'products' ? <div className="df-table-wrap"><table className="df-table"><thead><tr><th>Menu item</th><th>Category</th><th>Price</th><th>Order status</th><th>Item status</th><th /></tr></thead><tbody>{products.map((product) => <tr key={product._id}><td><strong>{product.name}</strong><small>{product.description || 'No description'}</small></td><td>{categoryById.get(product.categoryId) ?? <span className="df-warning-text">Category missing</span>}</td><td>{formatPrice(product.basePrice)}</td><td><button className={`df-toggle ${product.isAvailable ? 'on' : ''}`} disabled={busy} onClick={() => void withAction(() => setAvailability(product, !product.isAvailable), `Availability updated for ${product.name}.`)}><i />{product.isAvailable ? 'Available' : 'Unavailable'}</button></td><td><select className="df-inline-select" value={product.status} disabled={busy} onChange={(event) => void withAction(() => setStatus(product, event.target.value as Product['status']), `Status updated for ${product.name}.`)}><option>ACTIVE</option><option>INACTIVE</option><option>ARCHIVED</option></select></td><td><button className="df-icon-button danger-icon" title={`Delete ${product.name}`} disabled={busy} onClick={() => { if (window.confirm(`Delete “${product.name}”?`)) void withAction(() => deleteProduct(product), 'Menu item deleted.'); }}>⌫</button></td></tr>)}</tbody></table>{!products.length && <div className="df-empty">No menu items yet. Add your first item to get started.</div>}</div> : <div className="df-table-wrap"><table className="df-table"><thead><tr><th>Category</th><th>Description</th><th>Display priority</th><th>Status</th><th /></tr></thead><tbody>{categories.map((category) => <tr key={category._id}><td><strong>{category.name}</strong></td><td>{category.description || '—'}</td><td>{category.displayPriority ?? 0}</td><td><span className={`df-pill ${category.isActive ? 'success' : 'muted'}`}>{category.isActive ? 'Active' : 'Inactive'}</span></td><td><button className="df-icon-button danger-icon" title={`Delete ${category.name}`} disabled={busy} onClick={() => { if (window.confirm(`Delete category “${category.name}”?`)) void withAction(() => deleteCategory(category), 'Category deleted.'); }}>⌫</button></td></tr>)}</tbody></table>{!categories.length && <div className="df-empty">No categories yet. Create your first category.</div>}</div>}
      </section>
      <p className="df-footnote">Menu data is scoped to your restaurant and loaded from the Menu Service.</p>
    </>}

    {(view === 'ingredients' || view === 'allergens') && <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={{ label: view === 'ingredients' ? 'Add ingredient' : 'Add allergen', onClick: () => setResourceForm(true) }} />
      {(resourceError || resourceLoading) && <div className={`df-alert ${resourceError ? 'error' : ''}`}>{resourceError || 'Loading reference data…'}{resourceError && <button onClick={() => void loadResources()}>Retry</button>}</div>}
      {notice && <div className="df-alert success">{notice}</div>}
      <section className="df-panel"><div className="df-panel-heading"><div><p className="df-eyebrow">REFERENCE DATA</p><h2>{view === 'ingredients' ? `${ingredients.length} ingredients` : `${allergens.length} allergens`}</h2></div><button className="df-icon-button" onClick={() => void loadResources()} aria-label="Refresh">↻</button></div>
        {resourceForm && <ResourceForm kind={view} onCancel={() => setResourceForm(false)} onSubmit={(payload) => withAction(async () => { if (view === 'ingredients') await menuService.ingredients.create({ ...payload, restaurantId: user?.restaurantId }); else await menuService.allergens.create(payload); setResourceForm(false); await loadResources(); }, `${view === 'ingredients' ? 'Ingredient' : 'Allergen'} added.`)} />}
        {view === 'ingredients' ? <div className="df-card-list">{ingredients.map((item) => <article className="df-data-card" key={item._id}><span className="df-data-icon green">◉</span><div><strong>{item.name}</strong><small>{item.category}{item.description ? ` · ${item.description}` : ''}</small></div><span className={`df-pill ${item.isActive ? 'success' : 'muted'}`}>{item.isActive ? 'Active' : 'Inactive'}</span><button className="df-icon-button danger-icon" onClick={() => window.confirm(`Delete ingredient “${item.name}”?`) && void withAction(async () => { await menuService.ingredients.delete(item._id); await loadResources('ingredients'); }, 'Ingredient deleted.')}>⌫</button></article>)}{!ingredients.length && !resourceLoading && <div className="df-empty">No ingredients found. Add ingredients to prepare for recipe and food graph workflows.</div>}</div> : <div className="df-card-list">{allergens.map((item) => <article className="df-data-card" key={item._id}><span className="df-data-icon orange">!</span><div><strong>{item.name} <em>{item.code}</em></strong><small>{item.description || 'Allergen reference'}</small></div><span className={`df-pill ${item.isActive ? 'success' : 'muted'}`}>{item.isActive ? 'Active' : 'Inactive'}</span><button className="df-icon-button danger-icon" onClick={() => window.confirm(`Delete allergen “${item.name}”?`) && void withAction(async () => { await menuService.allergens.delete(item._id); await loadResources('allergens'); }, 'Allergen deleted.')}>⌫</button></article>)}{!allergens.length && !resourceLoading && <div className="df-empty">No allergen data found. Add the restaurant's allergen references.</div>}</div>}
      </section>
    </>}

    {view === 'api-routes' && <><PageHeader eyebrow={eyebrow} title={title} description={description} /><RouteMap /></>}
    {view === 'tables' && <TableManagement restaurantId={user?.restaurantId ?? ''} eyebrow={eyebrow} title={title} description={description} />}
    {view === 'revenue' && <TableRevenueAnalytics eyebrow={eyebrow} title={title} description={description} />}
    {view !== 'overview' && view !== 'menu' && view !== 'ingredients' && view !== 'allergens' && view !== 'api-routes' && view !== 'tables' && view !== 'revenue' && <><PageHeader eyebrow={eyebrow} title={title} description={description} /><ComingSoon view={view} /></>}
  </AppShell>;
}

function formatPrice(price: number) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(price || 0); }

function CatalogForm({ kind, categories, onCancel, onSubmit }: { kind: Tab; categories: Category[]; onCancel: () => void; onSubmit: (payload: Partial<Product | Category>) => void }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [price, setPrice] = useState(''); const [categoryId, setCategoryId] = useState(categories[0]?._id ?? ''); const [message, setMessage] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) { setMessage('Enter a name.'); return; } if (kind === 'categories') onSubmit({ name: name.trim(), description: description.trim(), isActive: true, displayPriority: 0 }); else if (!categoryId) setMessage('Create a category before adding menu items.'); else if (!Number.isFinite(Number(price)) || Number(price) <= 0) setMessage('Price must be greater than zero.'); else onSubmit({ name: name.trim(), description: description.trim(), basePrice: Number(price), categoryId, isAvailable: true, status: 'ACTIVE', dietaryTags: [], variantIds: [], modifierGroupIds: [] }); }
  return <form className="df-inline-form" onSubmit={submit}><div className="df-form-heading"><div><p className="df-eyebrow">NEW {kind === 'categories' ? 'CATEGORY' : 'MENU ITEM'}</p><h3>{kind === 'categories' ? 'Create a category' : 'Add a menu item'}</h3></div><button type="button" className="df-icon-button" onClick={onCancel} aria-label="Close">×</button></div>{message && <p className="df-form-error">{message}</p>}<div className="df-form-grid"><label>Name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'categories' ? 'e.g. Small plates' : 'e.g. Truffle fries'} /></label>{kind === 'products' && <label>Price (INR)<input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" /></label>}{kind === 'products' && <label>Category<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Select category</option>{categories.map((c) => <option value={c._id} key={c._id}>{c.name}</option>)}</select></label>}<label className="wide">Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short description for your team and guests" /></label></div><div className="df-form-actions"><button type="button" className="df-button df-button-subtle" onClick={onCancel}>Cancel</button><button className="df-button df-button-primary">Create {kind === 'categories' ? 'category' : 'item'}</button></div></form>;
}

function ResourceForm({ kind, onCancel, onSubmit }: { kind: 'ingredients' | 'allergens'; onCancel: () => void; onSubmit: (payload: Partial<Ingredient | Allergen>) => void }) {
  const [name, setName] = useState(''); const [category, setCategory] = useState(''); const [code, setCode] = useState(''); const [description, setDescription] = useState(''); const [message, setMessage] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim()) { setMessage('Name is required.'); return; } if (kind === 'ingredients' && !category.trim()) { setMessage('Ingredient category is required.'); return; } if (kind === 'allergens' && !code.trim()) { setMessage('Allergen code is required.'); return; } onSubmit(kind === 'ingredients' ? { name: name.trim(), category: category.trim(), description, isActive: true } : { name: name.trim(), code: code.trim().toUpperCase(), description, isActive: true }); }
  return <form className="df-inline-form" onSubmit={submit}><div className="df-form-heading"><div><p className="df-eyebrow">NEW REFERENCE</p><h3>Add {kind === 'ingredients' ? 'ingredient' : 'allergen'}</h3></div><button type="button" className="df-icon-button" onClick={onCancel} aria-label="Close">×</button></div>{message && <p className="df-form-error">{message}</p>}<div className="df-form-grid"><label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>{kind === 'ingredients' ? <label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Produce" /></label> : <label>Code<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. PEANUT" /></label>}<label className="wide">Description<input value={description} onChange={(e) => setDescription(e.target.value)} /></label></div><div className="df-form-actions"><button type="button" className="df-button df-button-subtle" onClick={onCancel}>Cancel</button><button className="df-button df-button-primary">Save reference</button></div></form>;
}

function RouteMap() {
  const groups = useMemo(() => apiRouteCatalog.reduce<Record<string, typeof apiRouteCatalog>>((map, route) => { (map[route.area] ??= []).push(route); return map; }, {}), []);
  return <div className="df-route-groups">{Object.entries(groups).map(([area, routes]) => <section className="df-panel" key={area}><div className="df-panel-heading"><div><p className="df-eyebrow">SERVICE ROUTES</p><h2>{area}</h2></div><span className="df-route-count">{routes.filter((r) => r.availability === 'live').length} live · {routes.filter((r) => r.availability === 'planned').length} planned</span></div><div className="df-route-list">{routes.map((route) => <div className="df-route" key={`${route.method}${route.path}`}><span className={`df-method method-${route.method.toLowerCase()}`}>{route.method}</span><code>{route.path}</code><span className="df-route-label">{route.label}</span><span className={`df-pill ${route.availability === 'live' ? 'success' : 'muted'}`}>{route.availability === 'live' ? 'Live' : 'Planned'}</span></div>)}</div></section>)}</div>;
}

function ComingSoon({ view }: { view: DashboardView }) {
  if (view === 'kitchen') {
    return (
      <section className="df-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍳</div>
        <h2 style={{ margin: '0 0 8px', color: '#314237', fontSize: '20px' }}>Kitchen Display Station (KDS)</h2>
        <p style={{ margin: '0 auto 24px', maxWidth: '520px', color: '#7a857b', fontSize: '13px', lineHeight: 1.6 }}>
          Follow live incoming customer tickets, advance order preparation stages, and sync order progress directly with customer devices.
        </p>
        <Link to="/kds" className="df-button df-button-primary" style={{ textDecoration: 'none', display: 'inline-flex', padding: '10px 20px', fontSize: '13px' }}>
          Open Fullscreen KDS ↗
        </Link>
      </section>
    );
  }
  const routes = apiRouteCatalog.filter((route) => route.availability === 'planned' && (view === 'food-intelligence' ? ['Food knowledge', 'Adaptive menu'].includes(route.area) : view === 'orders' ? route.area === 'Orders' : view === 'payments' ? route.area === 'Payments' : view === 'tables' ? route.area === 'Realtime' : ['assistant', 'simulation'].includes(view)));
  return <section className="df-coming-soon"><div className="df-coming-icon">✳</div><span className="df-pill muted">BACKEND IN PROGRESS</span><h2>This workflow is not connected yet</h2><p>The dashboard section is mapped to the DineFlow workflow, but its business API is not implemented in this project yet. It will become interactive when the service is available.</p>{routes.length > 0 && <div className="df-coming-routes"><strong>Planned endpoints</strong>{routes.map((route) => <div key={route.path}><span className={`df-method method-${route.method.toLowerCase()}`}>{route.method}</span><code>{route.path}</code></div>)}</div>}</section>;
}

function TableManagement({ restaurantId, eyebrow, title, description }: { restaurantId: string; eyebrow: string; title: string; description: string }) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [qr, setQr] = useState<TableQrResponse | null>(null);

  useEffect(() => {
    let active = true;
    async function loadTables() {
      if (!restaurantId) {
        setError('Your staff account is not assigned to a restaurant.');
        setLoading(false);
        return;
      }
      try {
        const result = await tableService.list();
        if (active) { setTables(result); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load tables.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadTables();
    return () => { active = false; };
  }, [restaurantId, refreshKey]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be completed.'); }
    finally { setBusy(false); }
  };

  const saveTable = (payload: TableRequest) => void run(async () => {
    if (editing) await tableService.update(editing.id, payload);
    else await tableService.create(payload);
    setFormOpen(false); setEditing(null); setRefreshKey((value) => value + 1);
  }, editing ? 'Table details updated.' : 'Table created. Generate its QR code when you are ready.');

  const changeStatus = (table: RestaurantTable, status: TableStatus) => void run(async () => {
    await tableService.setStatus(table.id, status); setRefreshKey((value) => value + 1);
  }, `Table ${table.tableNumber} status updated.`);

  const generateQr = (table: RestaurantTable) => void run(async () => {
    setQr(await tableService.issueQr(table.id));
  }, `QR code issued for table ${table.tableNumber}.`);

  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} action={{ label: 'Add table', onClick: () => { setEditing(null); setFormOpen(true); } }} />
    {(error || notice) && <div className={`df-alert ${error ? 'error' : 'success'}`} role={error ? 'alert' : 'status'}>{error || notice}<button onClick={() => setRefreshKey((value) => value + 1)}>{error ? 'Retry' : 'Refresh'}</button></div>}
    <section className="df-panel">
      <div className="df-panel-heading"><div><p className="df-eyebrow">TABLE SETUP</p><h2>{tables.length} tables</h2></div><button className="df-icon-button" onClick={() => setRefreshKey((value) => value + 1)} aria-label="Refresh tables">↻</button></div>
      {formOpen && <TableEditor key={editing?.id ?? 'new'} initial={editing} busy={busy} onCancel={() => { setFormOpen(false); setEditing(null); }} onSubmit={saveTable} />}
      {loading ? <div className="df-empty">Loading tables…</div> : <div className="df-table-wrap"><table className="df-table"><thead><tr><th>Table</th><th>Seats</th><th>Section</th><th>Status</th><th>QR code</th><th /></tr></thead><tbody>{tables.map((table) => <tr key={table.id}><td><strong>{table.displayName || `Table ${table.tableNumber}`}</strong><small>No. {table.tableNumber} · {table.id.slice(0, 8)}</small></td><td>{table.seatingCapacity}</td><td>{table.section || '—'}</td><td><select className="df-inline-select" value={table.status} disabled={busy} onChange={(event) => changeStatus(table, event.target.value as TableStatus)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option><option value="MAINTENANCE">MAINTENANCE</option></select></td><td><button className="df-text-button" disabled={busy} onClick={() => generateQr(table)}>Generate / rotate</button></td><td><button className="df-icon-button" disabled={busy} aria-label={`Edit table ${table.tableNumber}`} onClick={() => { setEditing(table); setFormOpen(true); }}>✎</button></td></tr>)}</tbody></table>{!tables.length && <div className="df-empty">No tables yet. Add your first restaurant table.</div>}</div>}
    </section>
    {qr && <section className="df-panel df-qr-panel"><div className="df-panel-heading"><div><p className="df-eyebrow">TABLE {qr.tableNumber}</p><h2>QR code ready to print</h2></div><button className="df-icon-button" aria-label="Close QR preview" onClick={() => setQr(null)}>×</button></div><div className="df-qr-content"><img src={qr.qrCodeDataUri} alt={`DineFlow ordering QR code for table ${qr.tableNumber}`} /><div><p>Scan this code to open the customer app for this table. Rotating the QR code revokes the previous code.</p><a className="df-button df-button-primary" href={qr.qrCodeDataUri} download={`dineflow-table-${qr.tableNumber}-qr.png`}>Download PNG</a><a className="df-qr-url" href={qr.customerUrl} target="_blank" rel="noreferrer">Open customer link</a><small>Credential version {qr.credentialVersion}</small></div></div></section>}
    <p className="df-footnote">Table access is scoped to your restaurant. QR credentials are reusable until rotated or the table is deactivated.</p>
  </>;
}

function TableEditor({ initial, busy, onCancel, onSubmit }: { initial: RestaurantTable | null; busy: boolean; onCancel: () => void; onSubmit: (request: TableRequest) => void }) {
  const [tableNumber, setTableNumber] = useState(initial?.tableNumber.toString() ?? '');
  const [seatingCapacity, setSeatingCapacity] = useState(initial?.seatingCapacity.toString() ?? '');
  const [section, setSection] = useState(initial?.section ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [message, setMessage] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const tableNo = Number(tableNumber); const seats = Number(seatingCapacity);
    if (!Number.isInteger(tableNo) || tableNo < 1) { setMessage('Table number must be a positive whole number.'); return; }
    if (!Number.isInteger(seats) || seats < 1) { setMessage('Seating capacity must be a positive whole number.'); return; }
    onSubmit({ tableNumber: tableNo, seatingCapacity: seats, section: section.trim() || undefined, displayName: displayName.trim() || undefined });
  }
  return <form className="df-inline-form" onSubmit={submit}><div className="df-form-heading"><div><p className="df-eyebrow">TABLE DETAILS</p><h3>{initial ? 'Update table' : 'Create a table'}</h3></div><button type="button" className="df-icon-button" onClick={onCancel} aria-label="Close">×</button></div>{message && <p className="df-form-error">{message}</p>}<div className="df-form-grid"><label>Table number<input type="number" min="1" step="1" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} /></label><label>Seating capacity<input type="number" min="1" step="1" value={seatingCapacity} onChange={(event) => setSeatingCapacity(event.target.value)} /></label><label>Section (optional)<input value={section} onChange={(event) => setSection(event.target.value)} placeholder="e.g. Patio" /></label><label>Display name (optional)<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Window table" /></label></div><div className="df-form-actions"><button type="button" className="df-button df-button-subtle" onClick={onCancel}>Cancel</button><button className="df-button df-button-primary" disabled={busy}>{initial ? 'Save changes' : 'Create table'}</button></div></form>;
}
