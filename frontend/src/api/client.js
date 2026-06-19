import axios from 'axios';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window === 'undefined') return '/api';
  return window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';
};

const client = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Import store dynamically to avoid circular dependencies
      import('../store/useStore').then(({ default: useStore }) => {
        useStore.getState().logout();
        if (typeof window !== 'undefined' && !['/portal', '/login', '/admin/login'].includes(window.location.pathname)) {
          window.location.href = '/portal';
        }
      });
    }
    return Promise.reject(error);
  }
);

export default client;
