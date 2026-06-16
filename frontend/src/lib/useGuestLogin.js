import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from './api.js';
import useAuthStore from '../store/authStore.js';

const ROLE_HOME = { client: '/client', freelancer: '/freelancer', admin: '/admin' };

export function useGuestLogin() {
  const [loadingRole, setLoadingRole] = useState(null);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();

  async function startGuest(role) {
    setLoadingRole(role);
    try {
      const { data } = await api.post('/api/auth/guest', { role });
      setUser(data.user);
      navigate(ROLE_HOME[data.user.role] ?? '/login', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not start demo session');
    } finally {
      setLoadingRole(null);
    }
  }

  return { startGuest, loadingRole };
}
