import api from './api';
import type { ApiSuccessResponse, AuthResponse, LoginCredentials, RegisterCredentials, User } from '../types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post<ApiSuccessResponse<AuthResponse>>('/auth/login', credentials);
    return data.data;
  },

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const { data } = await api.post<ApiSuccessResponse<AuthResponse>>('/auth/register', credentials);
    return data.data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<ApiSuccessResponse<{ user: User }>>('/auth/me');
    return data.data.user;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },
};
