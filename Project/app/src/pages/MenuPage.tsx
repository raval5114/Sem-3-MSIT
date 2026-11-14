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
  const { user, accessContext, logout, refreshAccessContext, hasPrivilege } = useAuth();
  const navigate = useNavigate();
  const restaurantId = accessContext?.restaurantId ?? undefined;
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
  const [imageProductId, setImageProductId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const canManageImages = hasPrivilege('MENU_UPDATE');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (resource === 'categories') setItems(await menuService.categories.list(restaurantId));
      else if (resource === 'products') setItems(await menuService.products.list({ restaurantId }));
      else if (resource === 'variants') setItems(await menuService.variants.list({ restaurantId }));
      else if (resource === 'modifierGroups') setItems(await menuService.modifierGroups.list({ restaurantId }));
      else if (resource === 'ingredients') setItems(await menuService.ingredients.list({ restaurantId }));
      else setItems(await menuService.allergens.list());
      if (resource === 'products' || resource === 'categories' || resource === 'variants' || resource === 'modifierGroups') {
        const [nextCategories, nextProducts] = await Promise.all([
          menuService.categories.list(restaurantId),
          menuService.products.list({ restaurantId }),
        ]);
        setCategories(nextCategories); setProducts(nextProducts);
      }
    } catch (cause) {
      setError(readError(cause));
      setItems([]); setCategories([]); setProducts([]);
      const status = typeof cause === 'object' && cause !== null && 'response' in cause
        ? (cause as { response?: { status?: number } }).response?.status
        : undefined;
      if (status === 401 || status === 403) void refreshAccessContext();
    }
    finally { setLoading(false); }
  }, [refreshAccessContext, resource, restaurantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const run = async (id: string, action: () => Promise<unknown>, message: string) => {
    setBusyId(id || 'new'); setNotice(''); setError('');
    try { await action(); setNotice(message); setFormItem(undefined); setDetails(null); await refresh(); }
    catch (cause) { setError(readError(cause)); }
    finally { setBusyId(''); }
  };

  const save = async (values: FormValues) => {
    const payload = toPayload(resource, values, restaurantId);
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

  const saveImage = async (product: Product) => {
    const nextUrl = imageUrl.trim();
    if (nextUrl && !/^https?:\/\//i.test(nextUrl)) {
      setError('Enter a valid image URL beginning with http:// or https://.');
      return;
    }
    await run(product._id, () => menuService.products.update(product._id, { imageUrl: nextUrl }), nextUrl ? 'Food image saved.' : 'Food image removed.');
    setImageProductId(''); setImageUrl('');
  };

  const uploadImage = async (product: Product, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file.'); return; }
    try {
      const dataUrl = await prepareFoodImage(file);
      await run(product._id, () => menuService.products.update(product._id, { imageUrl: dataUrl }), `Image uploaded for ${product.name}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The image could not be uploaded.'); }
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
      {resource === 'products' && <section className="df-food-images" aria-label="Food images">
        <div className="df-form-heading"><div><p className="df-eyebrow">MENU ITEM MEDIA</p><h3>Food images</h3></div><span className="df-pill muted">{products.filter((product) => product.imageUrl).length} images</span></div>
        <p className="df-footnote">Upload a food photo from your device or add an image URL. Changes use the same restaurant-scoped menu permissions as product updates.</p>
        {imageProductId && canManageImages && <form className="df-image-editor" onSubmit={(event) => { event.preventDefault(); const product = products.find((entry) => entry._id === imageProductId); if (product) void saveImage(product); }}>
          <label>Menu item<select value={imageProductId} onChange={(event) => { const id = event.target.value; setImageProductId(id); setImageUrl(products.find((entry) => entry._id === id)?.imageUrl ?? ''); }}><option value="">Select a menu item</option>{products.map((product) => <option value={product._id} key={product._id}>{product.name}</option>)}</select></label>
          <label className="wide">Image URL<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/food-photo.jpg" /></label>
          {imageUrl && <img className="df-food-image-preview" src={imageUrl} alt="Selected food preview" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} onLoad={(event) => { event.currentTarget.style.visibility = 'visible'; }} />}
          <div className="df-form-actions"><button type="button" className="df-button df-button-subtle" onClick={() => { setImageProductId(''); setImageUrl(''); }}>Cancel</button><button className="df-button df-button-primary" disabled={!!busyId || !imageProductId}>Save image</button></div>
        </form>}
        {products.length ? <div className="df-food-image-grid">{products.map((product) => <article className="df-food-image-card" key={product._id}>
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : <div className="df-food-image-empty" aria-label="No food image">🍽️</div>}
          <div><strong>{product.name}</strong><small>{product.imageUrl ? 'Image added' : 'No image yet'}</small></div>
          {canManageImages && <div className="df-row-actions"><label className="df-text-button df-upload-button">{product.imageUrl ? 'Upload / replace' : 'Upload image'}<input type="file" accept="image/*" aria-label={`Upload image for ${product.name}`} disabled={!!busyId} onChange={(event) => { void uploadImage(product, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><button className="df-text-button" onClick={() => { setImageProductId(product._id); setImageUrl(product.imageUrl?.startsWith('data:image/') ? '' : product.imageUrl ?? ''); }} disabled={!!busyId}>Use image URL</button>{product.imageUrl && <button className="df-text-button df-delete-action" onClick={() => { if (window.confirm(`Remove the image for “${product.name}”?`)) void run(product._id, () => menuService.products.update(product._id, { imageUrl: '' }), 'Food image removed.'); }} disabled={!!busyId}>Remove</button>}</div>}
        </article>)}</div> : <div className="df-empty">Add menu items first to manage their food images.</div>}
      </section>}
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

function prepareFoodImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('The selected file is not a usable image.'));
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) { reject(new Error('Image processing is unavailable in this browser.')); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (dataUrl.length > 4_500_000) { reject(new Error('This image is too large. Choose a smaller photo.')); return; }
        resolve(dataUrl);
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
