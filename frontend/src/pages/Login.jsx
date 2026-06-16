import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { useGuestLogin } from '../lib/useGuestLogin.js';

const ROLE_HOME = { client: '/client', freelancer: '/freelancer', admin: '/admin' };

export default function Login() {
  const navigate = useNavigate();
  const setUser  = useAuthStore((s) => s.setUser);
  const [form,  setForm]  = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { startGuest, loadingRole } = useGuestLogin();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', form);
      setUser(data.user);
      navigate(ROLE_HOME[data.user.role] ?? '/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <Link to="/" className="mb-4 self-start text-sm text-gray-500 hover:text-indigo-600 sm:self-auto sm:mr-auto sm:ml-0">
        ← Back to home
      </Link>

      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Sign in to FlexHire</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email" required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password" required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* ── Explore as Guest (no registration) ── */}
        <div className="mt-6">
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-gray-200" />
            <span className="mx-3 text-xs font-medium uppercase tracking-wide text-gray-400">
              or explore as guest
            </span>
            <div className="flex-grow border-t border-gray-200" />
          </div>

          <p className="mt-3 text-center text-xs text-gray-500">
            No account needed — jump straight into a live demo.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => startGuest('client')}
              disabled={loadingRole !== null}
              className="rounded-lg border border-indigo-200 bg-indigo-50 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              {loadingRole === 'client' ? 'Loading…' : 'View as Client'}
            </button>
            <button
              type="button"
              onClick={() => startGuest('freelancer')}
              disabled={loadingRole !== null}
              className="rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {loadingRole === 'freelancer' ? 'Loading…' : 'View as Freelancer'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          No account?{' '}
          <Link to="/signup" className="font-medium text-indigo-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
