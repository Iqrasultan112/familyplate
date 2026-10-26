import axios from 'axios';
import { notifyWeeklyMenuChanged } from './rewards';

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const apiBaseUrl = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/api$/i, '')}/api`
  : import.meta.env.PROD
    ? `${window.location.origin}/api`
    : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  const method = response.config?.method?.toLowerCase();
  const path = String(response.config?.url || '').split('?')[0].replace(/\/+$/, '');
  const menuWrite = ['post', 'patch', 'delete'].includes(method) && (
    /^\/weeklyMenu(?:\/|$)/i.test(path)
    || /^\/mealRequests\/\d+\/(?:approve|status)$/i.test(path)
    || /^\/events\/\d+\/finalize$/i.test(path)
    || /^\/events\/suggestions\/\d+\/approve$/i.test(path)
  );
  if (menuWrite) notifyWeeklyMenuChanged();
  return response;
}, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default api;
