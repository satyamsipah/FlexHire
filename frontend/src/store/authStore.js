import { create } from 'zustand';
import api from '../lib/api.js';

// Auth state lives in memory only — no localStorage.
// On every page mount, ProtectedRoute calls checkAuth() which hits GET /api/auth/me.
// If the httpOnly cookie is valid, the server returns the user; otherwise we get 401.
const useAuthStore = create((set) => ({
  user:       null,   // { name, email, role, walletBalance } | null
  isChecking: false,  // true while GET /me is in-flight (show spinner during this)

  setUser: (user) => set({ user }),

  logout: () => set({ user: null }),

  checkAuth: async () => {
    set({ isChecking: true });
    try {
      const { data } = await api.get('/api/auth/me');
      set({ user: data.user });
    } catch {
      set({ user: null });
    } finally {
      set({ isChecking: false });
    }
  },
}));

export default useAuthStore;
