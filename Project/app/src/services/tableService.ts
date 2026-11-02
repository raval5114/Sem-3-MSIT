import authApi from './authService';

export type TableStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface RestaurantTable {
  id: string;
  restaurantId: string;
  tableNumber: number;
  seatingCapacity: number;
  section: string | null;
  displayName: string | null;
  status: TableStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TableRequest {
  tableNumber: number;
  seatingCapacity: number;
  section?: string;
  displayName?: string;
}

export interface TableQrResponse {
  tableId: string;
  tableNumber: number;
  customerUrl: string;
  qrCodeDataUri: string;
  credentialVersion: number;
  issuedAt: string;
}

export interface TableSessionResponse {
  accessToken: string;
  tokenType: string;
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  tableSessionId: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export const tableService = {
  list: async (): Promise<RestaurantTable[]> => (await authApi.get<RestaurantTable[]>('/tables')).data,
  create: async (request: TableRequest): Promise<RestaurantTable> => (await authApi.post<RestaurantTable>('/tables', request)).data,
  update: async (tableId: string, request: TableRequest): Promise<RestaurantTable> => (await authApi.put<RestaurantTable>(`/tables/${tableId}`, request)).data,
  setStatus: async (tableId: string, status: TableStatus): Promise<RestaurantTable> => (await authApi.patch<RestaurantTable>(`/tables/${tableId}/status`, { status })).data,
  issueQr: async (tableId: string): Promise<TableQrResponse> => (await authApi.post<TableQrResponse>(`/tables/${tableId}/qr/rotate`)).data,
  initializeSession: async (tableId: string, qrToken: string): Promise<TableSessionResponse> =>
    (await authApi.post<TableSessionResponse>('/table-session/init', { tableId, qrToken })).data,
};
