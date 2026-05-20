import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

const ROLE_HOME = { client: '/client', freelancer: '/freelancer' };

export default function Signup() {
  const navigate = useNavigate();
  const setUser  = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/signup', form);
      setUser(data.user);
      navigate(ROLE_HOME[data.user.role] ?? '/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Create your account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input
              type="text" required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

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

          {/* Role selector — pill-style toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a…</label>
            <div className="flex gap-3">
              {['client', 'freelancer'].map((r) => (
                <button
                  key={r} type="button"
                  onClick={() => setForm({ ...form, role: r })}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold capitalize transition-colors ${
                    form.role === r
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
