import authApi from './authService';

export interface RestaurantSettings {
  restaurantId: string;
  name: string;
  contactPhone: string | null;
  address: string | null;
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: 'WAITER' | 'CHEF' | 'CASHIER';
  active: boolean;
}

export interface StaffRolePermissions {
  role: StaffAccount['role'];
  permissions: string[];
}

export const restaurantAdminService = {
  async getSettings(): Promise<RestaurantSettings> {
    return (await authApi.get<RestaurantSettings>('/admin/restaurant')).data;
  },
  async updateSettings(settings: Pick<RestaurantSettings, 'name' | 'contactPhone' | 'address'>): Promise<RestaurantSettings> {
    return (await authApi.put<RestaurantSettings>('/admin/restaurant', settings)).data;
  },
  async listStaff(): Promise<StaffAccount[]> {
    return (await authApi.get<StaffAccount[]>('/admin/staff')).data;
  },
  async createStaff(staff: { name: string; email: string; password: string; roleName: StaffAccount['role'] }): Promise<StaffAccount> {
    return (await authApi.post<StaffAccount>('/admin/staff', staff)).data;
  },
  async setStaffActive(userId: string, active: boolean): Promise<StaffAccount> {
    return (await authApi.patch<StaffAccount>(`/admin/staff/${encodeURIComponent(userId)}/active`, { active })).data;
  },
  async listRolePermissions(): Promise<StaffRolePermissions[]> {
    return (await authApi.get<StaffRolePermissions[]>('/admin/roles')).data;
  },
};
