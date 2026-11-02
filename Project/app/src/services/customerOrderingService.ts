import axios from 'axios';

const local = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const menuBase = import.meta.env.VITE_MENU_BASE_URL ?? (local ? `http://${host}:3001/api/v1/menu` : '/api/v1/menu');
const orderBase = import.meta.env.VITE_ORDER_BASE_URL ?? (local ? `http://${host}:3002` : '/api/v1/orders');
const paymentBase = import.meta.env.VITE_PAYMENT_BASE_URL ?? (local ? `http://${host}:3003` : '/api/v1/payments');

const guestApi = (baseURL: string) => axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
const menuApi = guestApi(menuBase);
const orderApi = guestApi(orderBase.replace(/\/$/, ''));
const paymentApi = guestApi(paymentBase.replace(/\/$/, ''));

export interface CustomerOption {
  optionId: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
}
export interface CustomerVariant { _id: string; name: string; isActive: boolean; options: CustomerOption[] }
export interface CustomerModifierGroup {
  _id: string; name: string; isActive: boolean; required: boolean;
  minimumSelection: number; maximumSelection: number; options: CustomerOption[];
}
export interface CustomerProduct {
  _id: string; restaurantId: string; categoryId: string; name: string; description?: string;
  basePrice: number; imageUrl?: string; dietaryTags?: string[]; preparationTimeMinutes?: number;
  variants: CustomerVariant[]; modifierGroups: CustomerModifierGroup[];
}
export interface CustomerCategory { _id: string; name: string; description?: string; products: CustomerProduct[] }
export interface CustomerOrderLine {
  productId: string; quantity: number;
  variantSelections: { variantId: string; optionId: string }[];
  modifierSelections: { groupId: string; optionIds: string[] }[];
}
export interface PlacedOrder {
  id: string; status: string; paymentMethod: string; paymentStatus: string;
  currency: string; subtotal: number; total: number; createdAt: string;
  items: { id?: string; name: string; quantity: number; unitPrice: number; lineTotal: number; selections: { groupName: string; optionName: string }[] }[];
}

export interface PaymentIntent {
  paymentId: string;
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  providerOrderId: string;
  keyId: string;
}

export interface PaymentVerifyResult {
  paymentId: string;
  orderId: string;
  status: string;
  orderStatus: string;
}

export interface OrderStatusInfo {
  id: string;
  restaurantId: string;
  tableId: string;
  tableSessionId: string;
  status: string;
  paymentStatus: string;
  updatedAt: string;
}

function tokenConfig() {
  const token = sessionStorage.getItem('customer_access_token');
  if (!token) throw new Error('Your table session is missing. Please scan the table QR again.');
  return { headers: { Authorization: `Bearer ${token}` } };
}

function staffConfig() {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Staff authentication required');
  return { headers: { Authorization: `Bearer ${token}` } };
}

export const customerOrderingService = {
  async getCatalog(restaurantId: string): Promise<CustomerCategory[]> {
    const { data } = await menuApi.get<{ success: boolean; data: CustomerCategory[] }>(`/customer/catalog/${encodeURIComponent(restaurantId)}`);
    if (!data.success || !Array.isArray(data.data)) throw new Error('The menu service returned an invalid menu.');
    return data.data;
  },
  async placeOrder(items: CustomerOrderLine[], paymentMethod: 'PAY_AT_COUNTER' | 'ONLINE' = 'PAY_AT_COUNTER'): Promise<PlacedOrder> {
    const { data } = await orderApi.post<{ success: boolean; data: PlacedOrder }>('/', { paymentMethod, items }, tokenConfig());
    return data.data;
  },
  async createPaymentIntent(orderId: string): Promise<PaymentIntent> {
    const { data } = await paymentApi.post<{ success: boolean; data: PaymentIntent }>('/create-intent', { orderId }, tokenConfig());
    return data.data;
  },
  async verifyPayment(verification: {
    orderId: string;
    paymentId: string;
    providerPaymentId: string;
    providerOrderId: string;
    signature: string;
  }): Promise<PaymentVerifyResult> {
    const { data } = await paymentApi.post<{ success: boolean; data: PaymentVerifyResult }>('/verify', verification, tokenConfig());
    return data.data;
  },
  async getOrderStatus(orderId: string): Promise<OrderStatusInfo> {
    const token = sessionStorage.getItem('customer_access_token') || localStorage.getItem('token');
    const { data } = await orderApi.get<{ success: boolean; data: OrderStatusInfo }>(`/${orderId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.data;
  },
  async getKitchenQueue(): Promise<PlacedOrder[]> {
    const { data } = await orderApi.get<{ success: boolean; data: PlacedOrder[] }>('/kitchen/queue', staffConfig());
    return data.data;
  },
  async updateOrderStatus(orderId: string, status: string): Promise<PlacedOrder> {
    const { data } = await orderApi.patch<{ success: boolean; data: PlacedOrder }>(`/${orderId}/status`, { status }, staffConfig());
    return data.data;
  },
};
