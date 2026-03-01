import axios from 'axios';

let BASE_URL;

if (import.meta.env.VITE_API_URL) {
  // Use explicit API URL if provided (e.g. in Vercel env vars)
  BASE_URL = `${import.meta.env.VITE_API_URL}/api`;
} else if (import.meta.env.MODE === 'production') {
  // Production fallback to your Render backend URL
  BASE_URL = 'https://splitwise-backend-5ljc.onrender.com/api';
} else {
  // Local development (Vite proxy to localhost:3001)
  BASE_URL = '/api';
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefresh } = res.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefresh);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
