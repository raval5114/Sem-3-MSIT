import axios from 'axios';

const isLocalApp = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const BUTLER_BASE_URL = import.meta.env.VITE_BUTLER_BASE_URL
  ?? (isLocalApp ? 'http://localhost:3001/api/v1/chat' : '/api/v1/chat');

export interface ButlerDraftAction {
  actionId: string;
  toolName: string;
  summary: string;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
}

export interface ButlerToolCall {
  toolName: string;
  status: string;
  summary: string;
}

export interface ButlerError {
  code: string;
  message: string;
}

export interface ButlerChatRequest {
  message?: string;
  conversationId?: string;
  restaurantId?: string;
  confirmation?: {
    actionId: string;
    confirmed: boolean;
  };
}

export interface ButlerChatResponse {
  success: boolean;
  conversationId: string;
  reply: string;
  role: 'assistant' | 'user';
  draftAction?: ButlerDraftAction;
  error?: ButlerError;
  toolCalls?: ButlerToolCall[];
  result?: unknown;
  results?: unknown[];
}

export const butlerApi = axios.create({
  baseURL: BUTLER_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

butlerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const butlerService = {
  send: async (payload: ButlerChatRequest): Promise<ButlerChatResponse> => {
    const { data } = await butlerApi.post<ButlerChatResponse>('/', payload);
    return data;
  },
};
