import axios from 'axios';

const isLocalApp = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const localMenuBaseUrl = `http://localhost:3001/api/v1/menu`;
const MENU_BASE_URL = import.meta.env.VITE_MENU_BASE_URL
  ?? (isLocalApp ? localMenuBaseUrl : '/api/v1/menu');

export const menuApi = axios.create({
  baseURL: MENU_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

menuApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Category {
  _id: string;
  restaurantId: string;
  name: string;
  description?: string;
  displayPriority?: number;
  isActive: boolean;
}

export interface Product {
  _id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  basePrice: number;
  isAvailable: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  dietaryTags: string[];
  spiceLevel?: number;
  imageUrl?: string;
  preparationTimeMinutes?: number;
  variantIds: string[];
  modifierGroupIds: string[];
  recipeId?: string | null;
  displayPriority?: number;
}

export interface VariantOption {
  optionId: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  displayPriority?: number;
}

export interface Variant {
  _id: string;
  restaurantId: string;
  productId: string;
  name: string;
  options: VariantOption[];
  isActive: boolean;
}

export type ModifierOption = VariantOption;

export interface ModifierGroup {
  _id: string;
  restaurantId: string;
  productId: string;
  name: string;
  required: boolean;
  minimumSelection: number;
  maximumSelection: number;
  options: ModifierOption[];
  isActive: boolean;
}

export interface Ingredient {
  _id: string;
  restaurantId: string;
  name: string;
  category: string;
  description?: string;
  isActive: boolean;
}

export interface Allergen {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface ProductDetails extends Product {
  category: Category | null;
  variants: Variant[];
  modifierGroups: ModifierGroup[];
}

interface ApiEnvelope<T> {
  data: T;
  count?: number;
  message?: string;
  success?: boolean;
}

async function list<T>(path: string, params?: Record<string, string | boolean | undefined>) {
  const { data } = await menuApi.get<ApiEnvelope<T[]> | T[]>(path, { params });
  const payload: unknown = data;
  // Accept both the documented service envelope and a plain array.
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const response = payload as Record<string, unknown>;
    if (Array.isArray(response.data)) return response.data as T[];

    const message = typeof response.message === 'string' ? response.message : '';
    if (response.success === false && message) {
      throw new Error(`Menu service error at ${path}: ${message}`);
    }

    const keys = Object.keys(response).join(', ') || 'none';
    throw new Error(`Unexpected response from ${path}: expected an array in "data", received keys: ${keys}.${message ? ` Service message: ${message}` : ''}`);
  }

  const responseType = payload === null ? 'null' : typeof payload;
  const preview = typeof payload === 'string'
    ? payload.replace(/\s+/g, ' ').slice(0, 180)
    : String(payload);
  throw new Error(`Unexpected response from ${path}: expected an array or an object containing "data", received ${responseType}${preview ? ` (${preview})` : ''}.`);
}

async function get<T>(path: string) {
  const { data } = await menuApi.get<ApiEnvelope<T>>(path);
  return data.data;
}

async function create<T>(path: string, payload: unknown) {
  const { data } = await menuApi.post<ApiEnvelope<T>>(path, payload);
  return data.data;
}

async function update<T>(path: string, payload: unknown) {
  const { data } = await menuApi.put<ApiEnvelope<T>>(path, payload);
  return data.data;
}

async function remove(path: string) {
  await menuApi.delete(path);
}

export const menuService = {
  categories: {
    list: (restaurantId?: string) => list<Category>('/categories', { restaurantId }),
    get: (id: string) => get<Category>(`/categories/${encodeURIComponent(id)}`),
    create: (payload: Partial<Category>) => create<Category>('/categories', payload),
    update: (id: string, payload: Partial<Category>) => update<Category>(`/categories/${encodeURIComponent(id)}`, payload),
    delete: (id: string) => remove(`/categories/${encodeURIComponent(id)}`),
  },
  products: {
    list: (filters: { restaurantId?: string; categoryId?: string; status?: string; isAvailable?: boolean } = {}) => list<Product>('/products', filters),
    get: (id: string) => get<Product>(`/products/${encodeURIComponent(id)}`),
    details: (id: string) => get<ProductDetails>(`/products/${encodeURIComponent(id)}/details`),
    variants: (id: string) => list<Variant>(`/products/${encodeURIComponent(id)}/variants`),
    modifierGroups: (id: string) => list<ModifierGroup>(`/products/${encodeURIComponent(id)}/modifier-groups`),
    create: (payload: Partial<Product>) => create<Product>('/products', payload),
    update: (id: string, payload: Partial<Product>) => update<Product>(`/products/${encodeURIComponent(id)}`, payload),
    setAvailability: async (id: string, isAvailable: boolean) => {
      const { data } = await menuApi.patch<ApiEnvelope<Product>>(`/products/${encodeURIComponent(id)}/availability`, { isAvailable });
      return data.data;
    },
    setStatus: async (id: string, status: Product['status']) => {
      const { data } = await menuApi.patch<ApiEnvelope<Product>>(`/products/${encodeURIComponent(id)}/status`, { status });
      return data.data;
    },
    delete: (id: string) => remove(`/products/${encodeURIComponent(id)}`),
  },
  variants: {
    list: (filters: { restaurantId?: string; productId?: string; isActive?: boolean } = {}) => list<Variant>('/variants', filters),
    get: (id: string) => get<Variant>(`/variants/${encodeURIComponent(id)}`),
    create: (payload: Partial<Variant>) => create<Variant>('/variants', payload),
    update: (id: string, payload: Partial<Variant>) => update<Variant>(`/variants/${encodeURIComponent(id)}`, payload),
    delete: (id: string) => remove(`/variants/${encodeURIComponent(id)}`),
  },
  modifierGroups: {
    list: (filters: { restaurantId?: string; productId?: string; isActive?: boolean } = {}) => list<ModifierGroup>('/modifier-groups', filters),
    get: (id: string) => get<ModifierGroup>(`/modifier-groups/${encodeURIComponent(id)}`),
    create: (payload: Partial<ModifierGroup>) => create<ModifierGroup>('/modifier-groups', payload),
    update: (id: string, payload: Partial<ModifierGroup>) => update<ModifierGroup>(`/modifier-groups/${encodeURIComponent(id)}`, payload),
    delete: (id: string) => remove(`/modifier-groups/${encodeURIComponent(id)}`),
  },
  ingredients: {
    list: (filters: { restaurantId?: string; category?: string; isActive?: boolean } = {}) => list<Ingredient>('/ingredients', filters),
    get: (id: string) => get<Ingredient>(`/ingredients/${encodeURIComponent(id)}`),
    create: (payload: Partial<Ingredient>) => create<Ingredient>('/ingredients', payload),
    update: (id: string, payload: Partial<Ingredient>) => update<Ingredient>(`/ingredients/${encodeURIComponent(id)}`, payload),
    delete: (id: string) => remove(`/ingredients/${encodeURIComponent(id)}`),
  },
  allergens: {
    list: (isActive?: boolean) => list<Allergen>('/allergens', { isActive }),
    get: (id: string) => get<Allergen>(`/allergens/${encodeURIComponent(id)}`),
    create: (payload: Partial<Allergen>) => create<Allergen>('/allergens', payload),
    update: (id: string, payload: Partial<Allergen>) => update<Allergen>(`/allergens/${encodeURIComponent(id)}`, payload),
    delete: (id: string) => remove(`/allergens/${encodeURIComponent(id)}`),
  },
};

export type RouteAvailability = 'live' | 'planned';
export interface ApiRouteInfo {
  method: string;
  path: string;
  label: string;
  area: string;
  availability: RouteAvailability;
}

export const apiRouteCatalog: ApiRouteInfo[] = [
  { method: 'POST', path: '/api/auth/login', label: 'Sign in', area: 'Authentication', availability: 'live' },
  { method: 'POST', path: '/api/auth/addNewUser', label: 'Register account', area: 'Authentication', availability: 'live' },
  { method: 'GET', path: '/api/auth/welcome', label: 'Welcome / session check', area: 'Authentication', availability: 'live' },
  { method: 'POST', path: '/api/auth/generateToken', label: 'Generate access token', area: 'Authentication', availability: 'live' },
  { method: 'GET', path: '/api/auth/user/userProfile', label: 'User profile', area: 'Authentication', availability: 'live' },
  { method: 'GET', path: '/api/auth/admin/adminProfile', label: 'Admin profile', area: 'Authentication', availability: 'live' },
  { method: 'GET', path: '/api/auth/tables', label: 'List restaurant tables', area: 'Tables & QR', availability: 'live' },
  { method: 'POST', path: '/api/auth/tables', label: 'Create table', area: 'Tables & QR', availability: 'live' },
  { method: 'PUT', path: '/api/auth/tables/:id', label: 'Update table', area: 'Tables & QR', availability: 'live' },
  { method: 'PATCH', path: '/api/auth/tables/:id/status', label: 'Set table status', area: 'Tables & QR', availability: 'live' },
  { method: 'POST', path: '/api/auth/tables/:id/qr/rotate', label: 'Issue or rotate table QR', area: 'Tables & QR', availability: 'live' },
  { method: 'POST', path: '/api/auth/table-session/init', label: 'Initialize customer table session', area: 'Tables & QR', availability: 'live' },
  ...[
    ['GET', '/categories', 'List categories'], ['POST', '/categories', 'Create category'],
    ['GET', '/categories/:id', 'Read category'], ['PUT', '/categories/:id', 'Update category'], ['DELETE', '/categories/:id', 'Delete category'],
    ['GET', '/products', 'List products'], ['POST', '/products', 'Create product'],
    ['GET', '/products/:id', 'Read product'], ['GET', '/products/:id/details', 'Product detail bundle'],
    ['PUT', '/products/:id', 'Update product'], ['DELETE', '/products/:id', 'Delete product'],
    ['PATCH', '/products/:id/availability', 'Set availability'], ['PATCH', '/products/:id/status', 'Set product status'],
    ['GET', '/products/:id/variants', 'List product variants'], ['GET', '/products/:id/modifier-groups', 'List modifier groups'],
    ['GET', '/variants', 'List variants'], ['POST', '/variants', 'Create variant'], ['GET', '/variants/:id', 'Read variant'], ['PUT', '/variants/:id', 'Update variant'], ['DELETE', '/variants/:id', 'Delete variant'],
    ['GET', '/modifier-groups', 'List modifier groups'], ['POST', '/modifier-groups', 'Create modifier group'], ['GET', '/modifier-groups/:id', 'Read modifier group'], ['PUT', '/modifier-groups/:id', 'Update modifier group'], ['DELETE', '/modifier-groups/:id', 'Delete modifier group'],
    ['GET', '/ingredients', 'List ingredients'], ['POST', '/ingredients', 'Create ingredient'], ['GET', '/ingredients/:id', 'Read ingredient'], ['PUT', '/ingredients/:id', 'Update ingredient'], ['DELETE', '/ingredients/:id', 'Delete ingredient'],
    ['GET', '/allergens', 'List allergens'], ['POST', '/allergens', 'Create allergen'], ['GET', '/allergens/:id', 'Read allergen'], ['PUT', '/allergens/:id', 'Update allergen'], ['DELETE', '/allergens/:id', 'Delete allergen'],
  ].map(([method, path, label]) => ({ method, path, label, area: 'Menu service', availability: 'live' as const })),
  { method: 'GET', path: '/api/v1/menu/items/:id/food-profile', label: 'Food profile', area: 'Food knowledge', availability: 'planned' },
  { method: 'GET', path: '/api/v1/menu/items/:id/allergens', label: 'Item allergens', area: 'Food knowledge', availability: 'planned' },
  { method: 'GET', path: '/api/v1/menu/items/:id/ingredients', label: 'Item ingredients', area: 'Food knowledge', availability: 'planned' },
  { method: 'GET', path: '/api/v1/menu/items/:id/dietary', label: 'Dietary tags', area: 'Food knowledge', availability: 'planned' },
  { method: 'GET', path: '/api/v1/menu/search?excludeAllergen=&diet=', label: 'Dietary/allergen search', area: 'Adaptive menu', availability: 'planned' },
  { method: 'GET', path: '/api/v1/menu/customer/catalog/:restaurantId', label: 'Browse customer menu', area: 'Menu service', availability: 'live' },
  { method: 'POST', path: '/api/v1/orders', label: 'Place table order', area: 'Orders', availability: 'live' },
  { method: 'GET', path: '/api/v1/orders/analytics/revenue', label: 'Restaurant table revenue summary', area: 'Analytics', availability: 'live' },
  { method: 'GET', path: '/api/v1/orders/analytics/tables/:tableId/revenue', label: 'Revenue for one table', area: 'Analytics', availability: 'live' },
  { method: 'GET', path: '/api/v1/orders/:id', label: 'Read order for active table session', area: 'Orders', availability: 'live' },
  { method: 'GET', path: '/api/v1/orders/:id/status', label: 'Track order', area: 'Orders', availability: 'planned' },
  { method: 'GET', path: '/api/v1/kitchen/orders/active', label: 'Kitchen queue', area: 'Kitchen', availability: 'planned' },
  { method: 'PATCH', path: '/api/v1/kitchen/orders/:id/status', label: 'Advance kitchen status', area: 'Kitchen', availability: 'planned' },
  { method: 'POST', path: '/api/v1/payments/create-intent', label: 'Create payment intent', area: 'Payments', availability: 'planned' },
  { method: 'POST', path: '/api/v1/payments/verify', label: 'Verify payment', area: 'Payments', availability: 'planned' },
  { method: 'GET', path: '/api/v1/orders/:id/invoice', label: 'Download invoice', area: 'Payments', availability: 'planned' },
  { method: 'WS', path: '/topic/kitchen/new-orders', label: 'Kitchen live updates', area: 'Realtime', availability: 'planned' },
  { method: 'WS', path: '/topic/table/:id/order-updates', label: 'Customer order tracking', area: 'Realtime', availability: 'planned' },
  { method: 'WS', path: '/topic/waiter/alerts', label: 'Waiter assistance alerts', area: 'Realtime', availability: 'planned' },
];
