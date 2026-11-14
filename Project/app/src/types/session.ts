export interface UserSession {
  sub?: string;
  email?: string;
  restaurantId?: string;
  type?: string;
  roles?: string[];
  privileges?: string[];
  exp?: number;
}

export interface AccessFeature {
  enabled: boolean;
  limits: Record<string, unknown>;
  source: string;
}

export interface AccessNavigationItem {
  featureKey: string;
  label: string;
  path: string;
}

export interface EffectiveAccessContext {
  userId: string;
  displayName: string | null;
  email: string;
  role: string;
  restaurantId: string | null;
  restaurantName: string | null;
  subscriptionStatus: string | null;
  authorizationVersions: Record<string, number>;
  features: Record<string, AccessFeature>;
  permissions: string[];
  navigation: AccessNavigationItem[];
}
