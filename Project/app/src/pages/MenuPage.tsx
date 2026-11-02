import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell, { type DashboardView } from '../components/dashboard/AppShell';
import PageHeader from '../components/dashboard/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
  menuService,
  type Allergen,
  type Category,
  type Ingredient,
  type ModifierGroup,
  type Product,
  type ProductDetails,
  type Variant,
} from '../services/menuService';
import '../dashboard.css';

type Resource = 'products' | 'categories' | 'variants' | 'modifierGroups' | 'ingredients' | 'allergens';
type CatalogItem = Product | Category | Variant | ModifierGroup | Ingredient | Allergen;
type FormValues = Record<string, string | boolean>;

const resourceLabels: Record<Resource, string> = {
  products: 'Menu items', categories: 'Categories', variants: 'Variants',
  modifierGroups: 'Modifier groups', ingredients: 'Ingredients', allergens: 'Allergens',
};

const fields: Record<Resource, { key: string; label: string; type?: 'number' | 'boolean' | 'json' | 'select' | 'tags'; required?: boolean }[]> = {
  categories: [
    { key: 'name', label: 'Category name', required: true }, { key: 'description', label: 'Description' },
    { key: 'displayPriority', label: 'Display priority', type: 'number' }, { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
  products: [
    { key: 'name', label: 'Menu item name', required: true }, { key: 'categoryId', label: 'Category', type: 'select', required: true },
    { key: 'description', label: 'Description' }, { key: 'basePrice', label: 'Price (INR)', type: 'number', required: true },
    { key: 'status', label: 'Status', type: 'select' }, { key: 'isAvailable', label: 'Available to order', type: 'boolean' },
    { key: 'dietaryTags', label: 'Dietary tags (comma separated)', type: 'tags' }, { key: 'spiceLevel', label: 'Spice level (0–5)', type: 'number' },
    { key: 'preparationTimeMinutes', label: 'Preparation time (minutes)', type: 'number' }, { key: 'displayPriority', label: 'Display priority', type: 'number' },
    { key: 'imageUrl', label: 'Image URL' }, { key: 'recipeId', label: 'Recipe ID' },
  ],
  variants: [
    { key: 'productId', label: 'Menu item', type: 'select', required: true }, { key: 'name', label: 'Variant name', required: true },
    { key: 'options', label: 'Options (JSON array)', type: 'json', required: true }, { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
  modifierGroups: [
    { key: 'productId', label: 'Menu item', type: 'select', required: true }, { key: 'name', label: 'Group name', required: true },
    { key: 'required', label: 'Selection required', type: 'boolean' }, { key: 'minimumSelection', label: 'Minimum selections', type: 'number' },
    { key: 'maximumSelection', label: 'Maximum selections', type: 'number' }, { key: 'options', label: 'Options (JSON array)', type: 'json', required: true },
    { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
  ingredients: [
    { key: 'name', label: 'Ingredient name', required: true }, { key: 'category', label: 'Category', required: true },
    { key: 'description', label: 'Description' }, { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
  allergens: [
    { key: 'code', label: 'Allergen code', required: true }, { key: 'name', label: 'Allergen name', required: true },
    { key: 'description', label: 'Description' }, { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
};

export default function MenuPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource>('products');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formItem, setFormItem] = useState<CatalogItem | null | undefined>(undefined);
  const [details, setDetails] = useState<ProductDetails | CatalogItem | null>(null);
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (resource === 'categories') setItems(await menuService.categories.list(user?.restaurantId));
      else if (resource === 'products') setItems(await menuService.products.list({ restaurantId: user?.restaurantId }));
      else if (resource === 'variants') setItems(await menuService.variants.list({ restaurantId: user?.restaurantId }));
      else if (resource === 'modifierGroups') setItems(await menuService.modifierGroups.list({ restaurantId: user?.restaurantId }));
      else if (resource === 'ingredients') setItems(await menuService.ingredients.list({ restaurantId: user?.restaurantId }));
      else setItems(await menuService.allergens.list());
      if (resource === 'products' || resource === 'categories' || resource === 'variants' || resource === 'modifierGroups') {
        const [nextCategories, nextProducts] = await Promise.all([
          menuService.categories.list(user?.restaurantId),
          menuService.products.list({ restaurantId: user?.restaurantId }),
        ]);
        setCategories(nextCategories); setProducts(nextProducts);
      }
    } catch (cause) { setError(readError(cause)); }
    finally { setLoading(false); }
  }, [resource, user?.restaurantId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (id: string, action: () => Promise<unknown>, message: string) => {
    setBusyId(id || 'new'); setNotice(''); setError('');
    try { await action(); setNotice(message); setFormItem(undefined); setDetails(null); await refresh(); }
    catch (cause) { setError(readError(cause)); }
    finally { setBusyId(''); }
  };

  const save = async (values: FormValues) => {
    const payload = toPayload(resource, values, user?.restaurantId);
    const current = formItem;
    await run(current?._id ?? 'new', async () => {
      if (!current) await createItem(resource, payload);
      else await updateItem(resource, current._id, payload);
    }, `${resourceLabels[resource].slice(0, -1)} ${current ? 'updated' : 'created'}.`);
  };

  const remove = (item: CatalogItem) => {
    if (!window.confirm(`Delete “${itemName(resource, item)}”? This action cannot be undone.`)) return;
    void run(item._id, () => deleteItem(resource, item._id), `${resourceLabels[resource].slice(0, -1)} deleted.`);
  };

  const openDetails = async (item: CatalogItem) => {
    setBusyId(item._id); setError(''); setDetails(null);
    try {
      if (resource === 'products') {
        const [product, variants, modifierGroups] = await Promise.all([
          menuService.products.details(item._id),
          menuService.products.variants(item._id),
          menuService.products.modifierGroups(item._id),
        ]);
        setDetails({ ...product, variants, modifierGroups });
      }
      else setDetails(await getItem(resource, item._id));
    } catch (cause) { setError(readError(cause)); }
    finally { setBusyId(''); }
  };

  const tabs = Object.keys(resourceLabels) as Resource[];
  const title = resourceLabels[resource];
  const onNavigate = (view: DashboardView) => {
    if (view === 'menu') return;
    navigate('/dashboard');
  };

  return <AppShell user={user ?? {}} activeView="menu" onNavigate={onNavigate} onLogout={() => { logout(); navigate('/login'); }}>
    <PageHeader eyebrow="MENU SERVICE · CRUD WORKSPACE" title="Menu management" description="Create, inspect, update, and remove the catalog data connected to the Menu Service API." action={{ label: `Add ${singular(resource)}`, onClick: () => setFormItem(null) }} />
    {(error || notice) && <div className={`df-alert ${error ? 'error' : 'success'}`} role="status">{error || notice}{error && <button onClick={() => void refresh()}>Retry</button>}</div>}
    <section className="df-panel df-menu-manager">
      <div className="df-panel-heading df-menu-tabs-heading">
        <div className="df-tabs df-menu-tabs" role="tablist" aria-label="Menu service resources">
          {tabs.map((tab) => <button key={tab} role="tab" aria-selected={resource === tab} className={resource === tab ? 'selected' : ''} onClick={() => { setResource(tab); setFormItem(undefined); setDetails(null); setNotice(''); setError(''); }}>{resourceLabels[tab]}<span>{tab === resource ? items.length : ''}</span></button>)}
        </div>
        <button className="df-icon-button" onClick={() => void refresh()} aria-label="Refresh resource">↻</button>
      </div>
      <div className="df-resource-summary"><div><strong>{title}</strong><small>GET · POST · PUT · DELETE{resource === 'products' ? ' · PATCH availability/status' : ''}</small></div><span className="df-pill success">{items.length} records</span></div>
      {formItem !== undefined && <ResourceEditor key={`${resource}-${formItem?._id ?? 'new'}`} resource={resource} item={formItem} categories={categories} products={products} onCancel={() => setFormItem(undefined)} onSave={save} saving={busyId === 'new' || (!!formItem && busyId === formItem._id)} />}
      {details && <div className="df-detail-drawer"><div className="df-form-heading"><div><p className="df-eyebrow">READ RECORD</p><h3>{itemName(resource, details)}</h3></div><button className="df-icon-button" onClick={() => setDetails(null)} aria-label="Close details">×</button></div><pre>{JSON.stringify(details, null, 2)}</pre></div>}
      {loading ? <div className="df-empty">Loading {title.toLowerCase()}…</div> : items.length ? <div className="df-table-wrap"><table className="df-table"><thead><tr><th>Name</th><th>Resource details</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td><strong>{itemName(resource, item)}</strong><small>{itemDescription(resource, item)}</small></td><td>{summaryFor(resource, item)}</td><td>{resource === 'products' ? <select className="df-inline-select" aria-label={`Set ${itemName(resource, item)} status`} value={(item as Product).status} disabled={busyId === item._id} onChange={(event) => void run(item._id, () => menuService.products.setStatus(item._id, event.target.value as Product['status']), 'Product status updated.') }><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select> : <span className={`df-pill ${isActive(item) ? 'success' : 'muted'}`}>{isActive(item) ? 'Active' : 'Inactive'}</span>}</td><td><div className="df-row-actions"><button className="df-text-button" disabled={busyId === item._id} onClick={() => void openDetails(item)}>View</button><button className="df-text-button" disabled={busyId === item._id} onClick={() => setFormItem(item)}>Edit</button>{resource === 'products' && <button className="df-text-button" disabled={busyId === item._id} onClick={() => void run(item._id, () => menuService.products.setAvailability(item._id, !(item as Product).isAvailable), 'Product availability updated.')}>{(item as Product).isAvailable ? 'Mark unavailable' : 'Mark available'}</button>}<button className="df-text-button df-delete-action" disabled={busyId === item._id} onClick={() => remove(item)}>Delete</button></div></td></tr>)}</tbody></table></div> : <div className="df-empty"><span>☷</span><strong>No {title.toLowerCase()} yet</strong><p>Create a record to start using this part of the menu catalog.</p><button className="df-button df-button-primary" onClick={() => setFormItem(null)}>＋ Add {singular(resource)}</button></div>}
    </section>
    <p className="df-footnote">Requests use the authenticated Menu Service client. Restaurant-scoped resources use the restaurant ID from your session.</p>
  </AppShell>;
}

function ResourceEditor({ resource, item, categories, products, onCancel, onSave, saving }: { resource: Resource; item: CatalogItem | null; categories: Category[]; products: Product[]; onCancel: () => void; onSave: (values: FormValues) => void; saving: boolean }) {
  const initial = useMemo(() => valuesFromItem(resource, item), [resource, item]);
  const [values, setValues] = useState<FormValues>(initial);
  const [formError, setFormError] = useState('');
  const change = (key: string, value: string | boolean) => setValues((old) => ({ ...old, [key]: value }));
  const options = resource === 'products' && (fields[resource].some((field) => field.key === 'categoryId')) ? categories : products;
  const submit = (event: FormEvent) => {
    event.preventDefault(); setFormError('');
    for (const field of fields[resource]) if (field.required && !String(values[field.key] ?? '').trim()) { setFormError(`${field.label} is required.`); return; }
    try { for (const field of fields[resource].filter((entry) => entry.type === 'json')) JSON.parse(String(values[field.key])); }
    catch { setFormError('Options must be valid JSON.'); return; }
    onSave(values);
  };
  return <form className="df-inline-form" onSubmit={submit}>
    <div className="df-form-heading"><div><p className="df-eyebrow">{item ? 'UPDATE RECORD' : 'CREATE RECORD'}</p><h3>{item ? `Edit ${singular(resource)}` : `Create ${singular(resource)}`}</h3></div><button type="button" className="df-icon-button" onClick={onCancel} aria-label="Close form">×</button></div>
    {formError && <p className="df-form-error">{formError}</p>}
    <div className="df-form-grid">
      {fields[resource].map((field) => <label key={field.key} className={field.type === 'json' ? 'wide' : ''}>{field.label}
        {field.type === 'boolean' ? <select value={String(values[field.key] ?? false)} onChange={(e) => change(field.key, e.target.value === 'true')}><option value="true">Yes</option><option value="false">No</option></select>
          : field.type === 'select' ? <select value={String(values[field.key] ?? '')} onChange={(e) => change(field.key, e.target.value)}><option value="">Select…</option>{field.key === 'status' ? <><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></> : options.map((option) => <option key={option._id} value={option._id}>{option.name}</option>)}</select>
            : field.type === 'json' ? <textarea rows={4} value={String(values[field.key] ?? '[]')} onChange={(e) => change(field.key, e.target.value)} placeholder={'[{"optionId":"...","name":"...","priceAdjustment":0,"isAvailable":true} ]'} />
              : <input type={field.type === 'number' ? 'number' : 'text'} min={field.type === 'number' ? '0' : undefined} step={field.key === 'basePrice' ? '0.01' : '1'} required={field.required} value={String(values[field.key] ?? '')} onChange={(e) => change(field.key, e.target.value)} placeholder={field.type === 'tags' ? 'vegetarian, spicy' : ''} />}
      </label>)}
    </div>
    <div className="df-form-actions"><button type="button" className="df-button df-button-subtle" onClick={onCancel}>Cancel</button><button className="df-button df-button-primary" disabled={saving}>{saving ? 'Saving…' : item ? 'Save changes' : 'Create record'}</button></div>
  </form>;
}

function valuesFromItem(resource: Resource, item: CatalogItem | null): FormValues {
  const source = (item ?? {}) as Record<string, unknown>; const values: FormValues = {};
  for (const field of fields[resource]) {
    const value = source[field.key];
    if (field.type === 'boolean') values[field.key] = typeof value === 'boolean' ? value : ['isActive', 'isAvailable'].includes(field.key);
    else if (field.type === 'json') values[field.key] = JSON.stringify(value ?? [], null, 2);
    else if (field.type === 'tags') values[field.key] = Array.isArray(value) ? value.join(', ') : '';
    else values[field.key] = value === undefined || value === null ? (field.key === 'status' ? 'ACTIVE' : '') : String(value);
  }
  return values;
}

function toPayload(resource: Resource, values: FormValues, restaurantId?: string) {
  const payload: Record<string, unknown> = { ...values };
  for (const field of fields[resource]) {
    if (field.type === 'number') payload[field.key] = values[field.key] === '' ? undefined : Number(values[field.key]);
    if (field.type === 'json') payload[field.key] = JSON.parse(String(values[field.key] || '[]'));
    if (field.type === 'tags') payload[field.key] = String(values[field.key] ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  if (resource !== 'allergens' && restaurantId) payload.restaurantId = restaurantId;
  if (resource === 'allergens' && typeof payload.code === 'string') payload.code = payload.code.toUpperCase().trim();
  return payload;
}

async function createItem(resource: Resource, payload: Record<string, unknown>) {
  if (resource === 'categories') return menuService.categories.create(payload as Partial<Category>);
  if (resource === 'products') return menuService.products.create(payload as Partial<Product>);
  if (resource === 'variants') return menuService.variants.create(payload as Partial<Variant>);
  if (resource === 'modifierGroups') return menuService.modifierGroups.create(payload as Partial<ModifierGroup>);
  if (resource === 'ingredients') return menuService.ingredients.create(payload as Partial<Ingredient>);
  return menuService.allergens.create(payload as Partial<Allergen>);
}

async function updateItem(resource: Resource, id: string, payload: Record<string, unknown>) {
  if (resource === 'categories') return menuService.categories.update(id, payload as Partial<Category>);
  if (resource === 'products') return menuService.products.update(id, payload as Partial<Product>);
  if (resource === 'variants') return menuService.variants.update(id, payload as Partial<Variant>);
  if (resource === 'modifierGroups') return menuService.modifierGroups.update(id, payload as Partial<ModifierGroup>);
  if (resource === 'ingredients') return menuService.ingredients.update(id, payload as Partial<Ingredient>);
  return menuService.allergens.update(id, payload as Partial<Allergen>);
}

async function deleteItem(resource: Resource, id: string) {
  if (resource === 'categories') return menuService.categories.delete(id);
  if (resource === 'products') return menuService.products.delete(id);
  if (resource === 'variants') return menuService.variants.delete(id);
  if (resource === 'modifierGroups') return menuService.modifierGroups.delete(id);
  if (resource === 'ingredients') return menuService.ingredients.delete(id);
  return menuService.allergens.delete(id);
}

async function getItem(resource: Resource, id: string): Promise<CatalogItem> {
  if (resource === 'categories') return menuService.categories.get(id);
  if (resource === 'products') return menuService.products.get(id);
  if (resource === 'variants') return menuService.variants.get(id);
  if (resource === 'modifierGroups') return menuService.modifierGroups.get(id);
  if (resource === 'ingredients') return menuService.ingredients.get(id);
  return menuService.allergens.get(id);
}

function itemName(resource: Resource, item: CatalogItem | ProductDetails) {
  if (resource === 'allergens') return (item as Allergen).name;
  return (item as Category | Product | Variant | ModifierGroup | Ingredient).name;
}
function itemDescription(resource: Resource, item: CatalogItem) {
  if (resource === 'allergens') return (item as Allergen).code;
  const record = item as Product | Category | Variant | ModifierGroup | Ingredient;
  return 'description' in record ? record.description || 'No description' : 'productId' in record ? `Menu item: ${record.productId}` : '—';
}
function summaryFor(resource: Resource, item: CatalogItem) {
  if (resource === 'products') return `₹${(item as Product).basePrice} · ${(item as Product).dietaryTags?.join(', ') || 'No dietary tags'}`;
  if (resource === 'categories') return `Priority ${(item as Category).displayPriority ?? 0}`;
  if (resource === 'variants') return `${(item as Variant).options?.length ?? 0} options`;
  if (resource === 'modifierGroups') return `${(item as ModifierGroup).options?.length ?? 0} options · ${(item as ModifierGroup).required ? 'Required' : 'Optional'}`;
  if (resource === 'ingredients') return (item as Ingredient).category;
  return (item as Allergen).code;
}
function isActive(item: CatalogItem) { return 'isActive' in item ? item.isActive : (item as Product).status === 'ACTIVE'; }
function singular(resource: Resource) { return ({ products: 'menu item', categories: 'category', variants: 'variant', modifierGroups: 'modifier group', ingredients: 'ingredient', allergens: 'allergen' })[resource]; }
function readError(cause: unknown) {
  if (typeof cause === 'object' && cause !== null && 'response' in cause) {
    const response = (cause as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return cause instanceof Error ? cause.message : 'The Menu Service request failed.';
}
