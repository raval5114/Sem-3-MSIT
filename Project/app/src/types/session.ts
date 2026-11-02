export interface UserSession {
  sub?: string;
  email?: string;
  restaurantId?: string;
  type?: string;
  roles?: string[];
  privileges?: string[];
  exp?: number;
}
