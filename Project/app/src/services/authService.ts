import axios from 'axios';
import type { EffectiveAccessContext } from '../types/session';

// In Docker: VITE_AUTH_BASE_URL is injected at build time via the Dockerfile ARG
// In local dev: falls back to the Vite proxy at /api/auth → localhost:8081/auth
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL ?? '/api/auth';

const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to all subsequent requests if available
authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  const publicAuthPaths = ['/login', '/generateToken', '/welcome', '/table-session/init', '/restaurant-registrations'];
  const requestUrl = config.url?.replace(/\/+$/, '') ?? '';
  const isPublicAuthRequest = publicAuthPaths.some((path) => requestUrl.endsWith(path));
  if (token && !isPublicAuthRequest) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (isPublicAuthRequest) {
    delete config.headers.Authorization;
  }
  return config;
});

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  roleName: string;
  restaurantId: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface RestaurantRegistrationRequest {
  restaurantName: string;
  ownerName: string;
  ownerEmail: string;
  phone?: string;
  address?: string;
}

export interface RestaurantRegistration {
  id: string;
  restaurantName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string | null;
  address: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  restaurantId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface PlatformRestaurant {
  id: string;
  restaurantId: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE' | 'PENDING_APPROVAL' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  restaurantId: string | null;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  reason: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface PlatformListQuery {
  status?: string;
  query?: string;
  page?: number;
  size?: number;
}

export interface FeatureDefinition {
  featureKey: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  limitsSupported: boolean;
}

export interface PlanFeatureEntitlement {
  featureKey: string;
  enabled: boolean;
  limits: Record<string, unknown>;
}

export interface SubscriptionPlan {
  id: string;
  planKey: string;
  name: string;
  description: string | null;
  active: boolean;
  customPlan: boolean;
  features: PlanFeatureEntitlement[];
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantSubscription {
  id: string;
  restaurantId: string;
  planId: string;
  planKey: string;
  planName: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'SUSPENDED';
  billingPeriod: 'MONTHLY' | 'ANNUAL' | 'CUSTOM';
  startsAt: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  cancelledAt: string | null;
  endedAt: string | null;
  entitlementsSnapshot: Record<string, { enabled: boolean; limits: Record<string, unknown> }>;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantEntitlementOverride {
  id: string;
  restaurantId: string;
  featureKey: string;
  enabled: boolean;
  reason: string;
  validFrom: string;
  validUntil: string | null;
  createdBy: string;
  updatedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const pageParams = (query: PlatformListQuery) => ({
  ...query,
  ...(query.status ? { status: query.status } : {}),
  ...(query.query ? { query: query.query } : {}),
});

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await authApi.post<LoginResponse>('/login', data);
    return response.data;
  },

  getAccessContext: async (): Promise<EffectiveAccessContext> => {
    const response = await authApi.get<EffectiveAccessContext>('/access/context');
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<string> => {
    const response = await authApi.post<string>('/addNewUser', data);
    return response.data;
  },

  getWelcome: async (): Promise<string> => {
    const response = await authApi.get<string>('/welcome');
    return response.data;
  },

  submitRestaurantRegistration: async (data: RestaurantRegistrationRequest): Promise<RestaurantRegistration> => {
    const response = await authApi.post<RestaurantRegistration>('/restaurant-registrations', data);
    return response.data;
  },

  platform: {
    listRegistrations: async (query: PlatformListQuery = {}): Promise<Page<RestaurantRegistration>> => {
      const response = await authApi.get<Page<RestaurantRegistration>>('/platform/registrations', { params: pageParams(query) });
      return response.data;
    },
    approveRegistration: async (id: string): Promise<RestaurantRegistration> => {
      const response = await authApi.post<RestaurantRegistration>(`/platform/registrations/${id}/approve`);
      return response.data;
    },
    rejectRegistration: async (id: string, reason: string): Promise<RestaurantRegistration> => {
      const response = await authApi.post<RestaurantRegistration>(`/platform/registrations/${id}/reject`, { reason });
      return response.data;
    },
    listRestaurants: async (query: PlatformListQuery = {}): Promise<Page<PlatformRestaurant>> => {
      const response = await authApi.get<Page<PlatformRestaurant>>('/platform/restaurants', { params: pageParams(query) });
      return response.data;
    },
    suspendRestaurant: async (restaurantId: string, reason: string): Promise<PlatformRestaurant> => {
      const response = await authApi.post<PlatformRestaurant>(`/platform/restaurants/${encodeURIComponent(restaurantId)}/suspend`, { reason });
      return response.data;
    },
    reactivateRestaurant: async (restaurantId: string): Promise<PlatformRestaurant> => {
      const response = await authApi.post<PlatformRestaurant>(`/platform/restaurants/${encodeURIComponent(restaurantId)}/reactivate`);
      return response.data;
    },
    listAuditLogs: async (query: Pick<PlatformListQuery, 'page' | 'size'> = {}): Promise<Page<AuditLog>> => {
      const response = await authApi.get<Page<AuditLog>>('/platform/audit-logs', { params: query });
      return response.data;
    },
    listFeatures: async (): Promise<FeatureDefinition[]> => {
      const response = await authApi.get<FeatureDefinition[]>('/platform/features');
      return response.data;
    },
    createFeature: async (feature: FeatureDefinition): Promise<FeatureDefinition> => {
      const response = await authApi.post<FeatureDefinition>('/platform/features', feature);
      return response.data;
    },
    updateFeature: async (featureKey: string, feature: FeatureDefinition): Promise<FeatureDefinition> => {
      const response = await authApi.put<FeatureDefinition>(`/platform/features/${encodeURIComponent(featureKey)}`, feature);
      return response.data;
    },
    listPlans: async (): Promise<SubscriptionPlan[]> => {
      const response = await authApi.get<SubscriptionPlan[]>('/platform/plans');
      return response.data;
    },
    createPlan: async (plan: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> => {
      const response = await authApi.post<SubscriptionPlan>('/platform/plans', plan);
      return response.data;
    },
    updatePlan: async (planId: string, plan: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> => {
      const response = await authApi.put<SubscriptionPlan>(`/platform/plans/${planId}`, plan);
      return response.data;
    },
    listSubscriptions: async (restaurantId: string): Promise<RestaurantSubscription[]> => {
      const response = await authApi.get<RestaurantSubscription[]>(`/platform/restaurants/${encodeURIComponent(restaurantId)}/subscriptions`);
      return response.data;
    },
    assignSubscription: async (restaurantId: string, request: {
      planId: string;
      status?: 'TRIALING' | 'ACTIVE';
      billingPeriod?: 'MONTHLY' | 'ANNUAL' | 'CUSTOM';
      currentPeriodEnd?: string;
      reason?: string;
    }): Promise<RestaurantSubscription> => {
      const response = await authApi.post<RestaurantSubscription>(
        `/platform/restaurants/${encodeURIComponent(restaurantId)}/subscriptions`, request);
      return response.data;
    },
    transitionSubscription: async (subscriptionId: string, request: {
      status: RestaurantSubscription['status'];
      reason: string;
      currentPeriodEnd?: string;
    }): Promise<RestaurantSubscription> => {
      const response = await authApi.put<RestaurantSubscription>(
        `/platform/subscriptions/${subscriptionId}/status`, request);
      return response.data;
    },
    listOverrides: async (restaurantId: string): Promise<RestaurantEntitlementOverride[]> => {
      const response = await authApi.get<RestaurantEntitlementOverride[]>(
        `/platform/restaurants/${encodeURIComponent(restaurantId)}/overrides`);
      return response.data;
    },
    createOverride: async (restaurantId: string, override: {
      featureKey: string;
      enabled: boolean;
      reason: string;
      validFrom?: string;
      validUntil?: string;
    }): Promise<RestaurantEntitlementOverride> => {
      const response = await authApi.post<RestaurantEntitlementOverride>(
        `/platform/restaurants/${encodeURIComponent(restaurantId)}/overrides`, override);
      return response.data;
    },
    revokeOverride: async (overrideId: string, reason: string): Promise<RestaurantEntitlementOverride> => {
      const response = await authApi.post<RestaurantEntitlementOverride>(
        `/platform/overrides/${overrideId}/revoke`, { reason });
      return response.data;
    },
  },
};

export default authApi;
