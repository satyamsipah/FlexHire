import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

// State badge colour mapping
const STATE_STYLES = {
  POSTED:      'bg-yellow-100 text-yellow-800',
  ACCEPTED:    'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED:   'bg-green-100 text-green-800',
  CANCELLED:   'bg-red-100 text-red-800',
};

const EMPTY_FORM = { title: '', description: '', totalBudget: '' };
const EMPTY_MILESTONE = { title: '', description: '', amount: '' };

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [projects,   setProjects]   = useState([]);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [milestones, setMilestones] = useState([]);
  const [formError,  setFormError]  = useState('');
  const [creating,   setCreating]   = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/api/projects');
      setProjects(data.projects);
    } catch {
      // silently fail — user will see empty list
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  async function handleLogout() {
    await api.post('/api/auth/logout');
    logout();
    navigate('/login', { replace: true });
  }

  function addMilestone() {
    setMilestones([...milestones, { ...EMPTY_MILESTONE }]);
  }

  function removeMilestone(idx) {
    setMilestones(milestones.filter((_, i) => i !== idx));
  }

  function updateMilestone(idx, field, value) {
    setMilestones(milestones.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      const payload = {
        ...form,
        totalBudget: Number(form.totalBudget),
        milestones:  milestones.map((m) => ({ ...m, amount: Number(m.amount) })),
      };
      await api.post('/api/projects', payload);
      setForm(EMPTY_FORM);
      setMilestones([]);
      fetchProjects();
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.name} <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">client</span>
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-8">
        {/* Create Project Form */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Post a New Project</h2>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  required rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Total budget (₹)</label>
                <input
                  type="number" required min="0"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={form.totalBudget}
                  onChange={(e) => setForm({ ...form, totalBudget: e.target.value })}
                />
              </div>
            </div>

            {/* Milestone sub-form */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Milestones</label>
                <button
                  type="button" onClick={addMilestone}
                  className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  + Add milestone
                </button>
              </div>

              <div className="space-y-3">
                {milestones.map((m, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Milestone {idx + 1}</span>
                      <button
                        type="button" onClick={() => removeMilestone(idx)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        required placeholder="Title"
                        className="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.title}
                        onChange={(e) => updateMilestone(idx, 'title', e.target.value)}
                      />
                      <input
                        required type="number" min="0" placeholder="Amount (₹)"
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.amount}
                        onChange={(e) => updateMilestone(idx, 'amount', e.target.value)}
                      />
                      <input
                        required placeholder="Description"
                        className="col-span-3 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.description}
                        onChange={(e) => updateMilestone(idx, 'description', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <button
              type="submit" disabled={creating}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? 'Posting…' : 'Post project'}
            </button>
          </form>
        </section>

        {/* My Projects List */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">My Projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">No projects yet — post your first one above.</p>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{p.title}</h3>
                      <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>
                    </div>
                    <span className={`ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[p.state] ?? ''}`}>
                      {p.state}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400">
                    <span>₹{p.totalBudget.toLocaleString()}</span>
                    <span>{p.milestones.length} milestone{p.milestones.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
