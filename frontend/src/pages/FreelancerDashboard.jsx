import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

export default function FreelancerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [projects,  setProjects]  = useState([]);
  const [accepting, setAccepting] = useState(null); // project _id being accepted
  const [error,     setError]     = useState('');

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/api/projects');
      setProjects(data.projects);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  async function handleLogout() {
    await api.post('/api/auth/logout');
    logout();
    navigate('/login', { replace: true });
  }

  async function handleAccept(projectId) {
    setError('');
    setAccepting(projectId);
    try {
      await api.post(`/api/projects/${projectId}/accept`);
      // Accepted project is no longer POSTED — remove it from the list
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not accept project');
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.name}{' '}
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              freelancer
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
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Open Projects</h2>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">No open projects right now — check back soon.</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{p.title}</h3>
                    <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>
                    <div className="mt-2 flex gap-4 text-xs text-gray-400">
                      <span>Budget: ₹{p.totalBudget.toLocaleString()}</span>
                      <span>{p.milestones.length} milestone{p.milestones.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Milestone breakdown */}
                    {p.milestones.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {p.milestones.map((m) => (
                          <li key={m._id} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-medium">{m.title}</span>
                            <span className="text-gray-400">—</span>
                            <span>₹{m.amount.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <button
                    onClick={() => handleAccept(p._id)}
                    disabled={accepting === p._id}
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {accepting === p._id ? 'Accepting…' : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
