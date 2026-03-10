import axios from 'axios';
import type { TokenResponse, Chat, ChatWithMessages, Message, APIKey } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  signup: (data: { name: string; email: string; password: string; confirm_password: string }) =>
    api.post<TokenResponse>('/api/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>('/api/auth/login', data),
  googleAuth: (token: string) =>
    api.post<TokenResponse>('/api/auth/google', { token }),
  verifyEmail: (token: string) =>
    api.post('/api/auth/verify-email', { token }),
  resendVerification: (email: string) =>
    api.post('/api/auth/resend-verification', { email }),
  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string; confirm_password: string }) =>
    api.post('/api/auth/reset-password', data),
  getMe: () => api.get<TokenResponse['user']>('/api/auth/me'),
  deleteAccount: () => api.delete('/api/auth/delete-account'),
};

// Chats
export const chatAPI = {
  list: () => api.get<Chat[]>('/api/chats/'),
  create: (title?: string) => api.post<Chat>('/api/chats/', { title }),
  get: (chatId: string) => api.get<ChatWithMessages>(`/api/chats/${chatId}`),
  delete: (chatId: string) => api.delete(`/api/chats/${chatId}`),
  sendMessage: (content: string, chatId?: string, voiceMode?: boolean, fileContents?: { name: string; content: string; is_image?: boolean }[]) =>
    api.post<Message>('/api/chats/message', {
      content,
      chat_id: chatId,
      voice_mode: voiceMode || false,
      file_contents: fileContents || null,
    }),
};

// Voice
export const voiceAPI = {
  tts: (text: string, language: string = 'en') =>
    api.post('/api/voice/tts', { text, language }, { responseType: 'blob' }),
  languages: () => api.get('/api/voice/languages'),
};

// API Keys
export const apiKeyAPI = {
  list: () => api.get<APIKey[]>('/api/keys/'),
  create: (name: string) => api.post<APIKey>('/api/keys/', { name }),
  delete: (keyId: string) => api.delete(`/api/keys/${keyId}`),
  toggle: (keyId: string) => api.put(`/api/keys/${keyId}/toggle`),
};

export default api;
