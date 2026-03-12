import axios from 'axios';

// In production, Vercel proxies /api/* to Railway — use relative path.
// In dev, proxy isn't available so we hit the backend directly.
const BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5001') + '/api'
  : '/api';

// Axios instance — cookies sent automatically via withCredentials
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Handle authentication errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('school_user');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
