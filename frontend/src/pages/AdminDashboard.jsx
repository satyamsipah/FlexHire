import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire — Admin</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.name}{' '}
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              admin
            </span>
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">Dispute management UI coming in Week 7.</p>
        </div>
      </main>
    </div>
  );
}
