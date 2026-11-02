import axios from 'axios';

const local = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const orderBase = import.meta.env.VITE_ORDER_BASE_URL ?? (local ? `http://${host}:3002` : '/api/v1/orders');

const orderApi = axios.create({ baseURL: orderBase, headers: { 'Content-Type': 'application/json' } });
orderApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface TableRevenueRow {
  tableId: string;
  completedOrders: number;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  currency: string;
}

export interface TableRevenueReport {
  restaurantId?: string;
  tableId?: string;
  period: { from: string; to: string };
  completedOrders: number;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  currency: string;
  tables?: TableRevenueRow[];
}

export const revenueService = {
  async getRestaurantRevenue(from: string, to: string): Promise<TableRevenueReport> {
    const { data } = await orderApi.get<{ success: boolean; data: TableRevenueReport }>('/analytics/revenue', { params: { from, to } });
    if (!data.success || !data.data) throw new Error('The revenue service returned an invalid report.');
    return data.data;
  },
};
