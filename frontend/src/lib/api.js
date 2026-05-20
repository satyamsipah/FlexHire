import axios from 'axios';

// withCredentials:true is required so the browser sends the httpOnly cookie on every request.
// The Vite proxy (vite.config.js) forwards /api/* to http://localhost:5001.
const api = axios.create({
  baseURL:         '',
  withCredentials: true,
});

export default api;
