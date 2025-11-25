import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Bank Credentials
export const credentialService = {
  create: (data) => api.post('/bank-credentials', data),
  list: () => api.get('/bank-credentials'),
  get: (id) => api.get(`/bank-credentials/${id}`),
  update: (id, data) => api.put(`/bank-credentials/${id}`, data),
  delete: (id) => api.delete(`/bank-credentials/${id}`),
  testLogin: (id) => api.post(`/bank-credentials/${id}/test-login`),
};

// Simulations
export const simulationService = {
  create: (data) => api.post('/simulations', data),
  createBatch: (data) => api.post('/simulations/batch', data),
  list: (params) => api.get('/simulations', { params }),
  get: (id) => api.get(`/simulations/${id}`),
  getLogs: (id) => api.get(`/simulations/${id}/logs`),
  getStats: () => api.get('/simulations/stats'),
  delete: (id) => api.delete(`/simulations/${id}`),
};

export default api;
