import axios from 'axios';

console.log('API URL:', import.meta.env.VITE_API_URL);
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dear-us-token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (!error.response) {
      console.error('API connection error:', error);

      return Promise.reject(
        new Error('Unable to connect to the server.'),
      );
    }

    if (error.response.status === 401) {
      console.warn('Unauthorized request.');
    }

    return Promise.reject(error);
  },
);

export default api;