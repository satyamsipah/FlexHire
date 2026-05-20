import axios from 'axios';

// In production (Vercel) VITE_API_URL = https://flexhire-backend.onrender.com
// In development it falls back to the local backend — Vite proxy still works for /api
// but we point directly so Socket.io can also use the same base URL.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL:         API_URL,
  withCredentials: true,   // send httpOnly cookie on every request
});

export default api;
