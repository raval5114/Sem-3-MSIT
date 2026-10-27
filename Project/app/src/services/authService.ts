import axios from 'axios';

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
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await authApi.post<LoginResponse>('/login', data);
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
};

export default authApi;

