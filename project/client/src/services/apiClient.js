import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function normalizeErrorMessage(error) {
  const explicitMessage = error.response?.data?.message;
  if (explicitMessage) return explicitMessage;

  const status = error.response?.status;
  const url = error.config?.url || '';

  if (status === 404 && url.includes('/api/reports/latest')) {
    return 'No saved report was found yet. Run an analysis or upload files first.';
  }

  if (status === 404) {
    return 'The requested resource could not be found.';
  }

  if (status === 401 || status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status >= 500) {
    return 'The backend ran into an error while processing the request.';
  }

  if (error.code === 'ECONNABORTED') {
    return 'The request took too long to finish. Please try again.';
  }

  if (error.message === 'Network Error') {
    return 'Cannot reach the backend service on port 3001.';
  }

  return error.message || 'An unexpected error occurred.';
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---- Attach JWT to every request ----
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('log_analyzer_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = normalizeErrorMessage(error);

    // Auto-logout on 401 (expired/invalid token)
    if (error.response?.status === 401) {
      localStorage.removeItem('log_analyzer_token');
      // Redirect to login only if not already on auth pages
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }

    console.error(
      `[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}: ${message}`
    );

    return Promise.reject(new Error(message));
  }
);

export default apiClient;
