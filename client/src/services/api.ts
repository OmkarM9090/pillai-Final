import axios, { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';

// Ensure the base URL ends with /api/v1
let baseUrl = import.meta.env.VITE_API_URL || '';
if (baseUrl && !baseUrl.endsWith('/api/v1')) {
  baseUrl = baseUrl.replace(/\/$/, '') + '/api/v1';
}
const BASE_URL = baseUrl || '/api/v1';

// ============================================================
// Axios instance
// ============================================================
export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ============================================================
// Request interceptor: attach JWT token
// ============================================================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// Response interceptor: handle 401 globally
// ============================================================
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
