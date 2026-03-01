let API_URL = import.meta.env.VITE_API_URL || '';

// In production, fall back to your Render backend if no env var is set
if (!API_URL && import.meta.env.MODE === 'production') {
  API_URL = 'https://splitwise-backend-5ljc.onrender.com';
}

export { API_URL };

export const GOOGLE_AUTH_URL = API_URL
  ? `${API_URL}/api/auth/google`
  : '/api/auth/google';
