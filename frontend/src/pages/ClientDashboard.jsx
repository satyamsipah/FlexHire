import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

const PROJECT_STATE_STYLES = {
  POSTED:      'bg-yellow-100 text-yellow-800',
  ACCEPTED:    'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED:   'bg-green-100 text-green-800',
  CANCELLED:   'bg-red-100 text-red-800',
};

const M_STATE_STYLES = {
  CREATED:       'bg-gray-100 text-gray-700',
  FUNDED:        'bg-blue-100 text-blue-700',
  IN_PROGRESS:   'bg-yellow-100 text-yellow-800',
  SUBMITTED:     'bg-orange-100 text-orange-800',
  APPROVED:      'bg-green-100 text-green-800',
  DISPUTED:      'bg-red-100 text-red-800',
  REFUNDED:      'bg-rose-200 text-rose-900',
  AUTO_REFUNDED: 'bg-purple-100 text-purple-800',
  CANCELLED:     'bg-slate-100 text-slate-600',
};

const EMPTY_FORM      = { title: '', description: '', totalBudget: '' };
const EMPTY_MILESTONE = { title: '', description: '', amount: '' };

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-xl ${n <= value ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [projects,   setProjects]   = useState([]);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [milestones, setMilestones] = useState([]);
  const [formError,  setFormError]  = useState('');
  const [creating,   setCreating]   = useState(false);
  const [acting,     setActing]     = useState(null);
  const [actionErr,  setActionErr]  = useState('');
  // { [projectId]: { rating, comment, submitting, submitted } }
  const [reviews,    setReviews]    = useState({});

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/api/projects');
      setProjects(data.projects);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Check which completed projects the client has already reviewed
  useEffect(() => {
    const completed = projects.filter(p => p.state === 'COMPLETED');
    completed.forEach(p => {
      api.get(`/api/reviews/${p._id}/mine`)
        .then(({ data }) => {
          if (data.review) {
            setReviews(r => ({ ...r, [p._id]: { ...r[p._id], submitted: true } }));
          }
        })
        .catch(() => {});
    });
  }, [projects]);

  async function handleLogout() {
    await api.post('/api/auth/logout');
    logout();
    navigate('/login', { replace: true });
  }

  // ── Project creation ─────────────────────────────────────────────────────────
  function addMilestone()       { setMilestones([...milestones, { ...EMPTY_MILESTONE }]); }
  function removeMilestone(idx) { setMilestones(milestones.filter((_, i) => i !== idx)); }
  function updateMilestone(idx, field, value) {
    setMilestones(milestones.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      await api.post('/api/projects', {
        ...form,
        totalBudget: Number(form.totalBudget),
        milestones:  milestones.map(m => ({ ...m, amount: Number(m.amount) })),
      });
      setForm(EMPTY_FORM);
      setMilestones([]);
      fetchProjects();
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  // ── Milestone actions ────────────────────────────────────────────────────────
  async function handleFund(milestoneId) {
    setActionErr('');
    setActing(milestoneId);
    try {
      const { data } = await api.post(`/api/milestones/${milestoneId}/fund`);
      const rzp = new window.Razorpay({
        key:         data.razorpayKeyId,
        order_id:    data.orderId,
        amount:      data.amount,
        currency:    data.currency,
        name:        'FlexHire',
        description: 'Milestone funding',
        handler: () => {
          alert('Payment submitted! The milestone will be marked funded in a few seconds.');
          fetchProjects();
        },
        modal: { ondismiss: () => setActing(null) },
      });
      rzp.open();
    } catch (err) {
      setActionErr(err.response?.data?.error ?? 'Could not initiate payment');
      setActing(null);
    }
  }

  async function handleApprove(milestoneId) {
    setActionErr('');
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/approve`);
      fetchProjects();
    } catch (err) {
      setActionErr(err.response?.data?.error ?? 'Approval failed');
    } finally {
      setActing(null);
    }
  }

  async function handleDispute(milestoneId) {
    const reason = window.prompt('Describe the issue (min 10 characters):');
    if (!reason?.trim()) return;
    setActionErr('');
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/dispute`, { reason });
      fetchProjects();
    } catch (err) {
      setActionErr(err.response?.data?.error ?? 'Could not raise dispute');
    } finally {
      setActing(null);
    }
  }

  // ── Reviews ──────────────────────────────────────────────────────────────────
  async function handleReview(projectId) {
    const rev = reviews[projectId] ?? {};
    if (!rev.rating) return;
    setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: true } }));
    try {
      await api.post(`/api/reviews/${projectId}`, { rating: rev.rating, comment: rev.comment ?? '' });
      setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: false, submitted: true } }));
    } catch (err) {
      setActionErr(err.response?.data?.error ?? 'Review failed');
      setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: false } }));
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.name}{' '}
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">client</span>
          </span>
          <button onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-8">

        {/* ── Create Project form ── */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Post a New Project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea required rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total budget (₹)</label>
                <input required type="number" min="0"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  value={form.totalBudget} onChange={e => setForm({ ...form, totalBudget: e.target.value })} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Milestones</label>
                <button type="button" onClick={addMilestone}
                  className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">
                  + Add milestone
                </button>
              </div>
              <div className="space-y-3">
                {milestones.map((m, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Milestone {idx + 1}</span>
                      <button type="button" onClick={() => removeMilestone(idx)}
                        className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input required placeholder="Title"
                        className="col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.title} onChange={e => updateMilestone(idx, 'title', e.target.value)} />
                      <input required type="number" min="0" placeholder="Amount (₹)"
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.amount} onChange={e => updateMilestone(idx, 'amount', e.target.value)} />
                      <input required placeholder="Description"
                        className="col-span-3 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.description} onChange={e => updateMilestone(idx, 'description', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button type="submit" disabled={creating}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {creating ? 'Posting…' : 'Post project'}
            </button>
          </form>
        </section>

        {/* ── My Projects ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">My Projects</h2>
          {actionErr && <p className="mb-3 text-sm text-red-600">{actionErr}</p>}

          {projects.length === 0
            ? <p className="text-sm text-gray-500">No projects yet — post your first one above.</p>
            : (
              <div className="space-y-4">
                {projects.map(p => (
                  <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                    {/* Project header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{p.title}</h3>
                        <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>
                        <div className="mt-1 flex gap-4 text-xs text-gray-400">
                          <span>₹{p.totalBudget.toLocaleString()}</span>
                          <span>{p.milestones.length} milestone{p.milestones.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PROJECT_STATE_STYLES[p.state] ?? ''}`}>
                          {p.state}
                        </span>
                        {p.state !== 'POSTED' && (
                          <Link
                            to={`/project/${p._id}/chat`}
                            className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            Chat
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Milestone rows */}
                    {p.milestones.length > 0 && (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        {p.milestones.map(m => (
                          <div key={m._id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${M_STATE_STYLES[m.state] ?? ''}`}>
                                {m.state}
                              </span>
                              <span className="truncate text-sm font-medium text-gray-800">{m.title}</span>
                              <span className="shrink-0 text-xs text-gray-400">₹{m.amount.toLocaleString()}</span>
                            </div>

                            <div className="ml-3 flex shrink-0 items-center gap-2">
                              {m.state === 'CREATED' && (
                                <button
                                  onClick={() => handleFund(m._id)}
                                  disabled={acting === m._id}
                                  className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                                  {acting === m._id ? '…' : 'Fund'}
                                </button>
                              )}
                              {m.state === 'SUBMITTED' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(m._id)}
                                    disabled={acting === m._id}
                                    className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                                    {acting === m._id ? '…' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => handleDispute(m._id)}
                                    disabled={acting === m._id}
                                    className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                                    Dispute
                                  </button>
                                  {m.submissionNote && (
                                    <span className="max-w-xs truncate text-xs italic text-gray-500" title={m.submissionNote}>
                                      "{m.submissionNote}"
                                    </span>
                                  )}
                                </>
                              )}
                              {m.state === 'DISPUTED' && (
                                <span className="text-xs text-red-600 italic">Awaiting admin resolution</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review prompt for completed projects */}
                    {p.state === 'COMPLETED' && (() => {
                      const rev = reviews[p._id] ?? {};
                      if (rev.submitted) {
                        return (
                          <p className="mt-3 border-t pt-3 text-xs text-emerald-600">
                            ✓ You've rated this project
                          </p>
                        );
                      }
                      return (
                        <div className="mt-3 border-t pt-3 space-y-2">
                          <p className="text-xs font-medium text-gray-700">Rate your experience with the freelancer:</p>
                          <StarRating
                            value={rev.rating ?? 0}
                            onChange={n => setReviews(r => ({ ...r, [p._id]: { ...r[p._id], rating: n } }))}
                          />
                          <textarea
                            rows={2}
                            placeholder="Optional comment…"
                            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                            value={rev.comment ?? ''}
                            onChange={e => setReviews(r => ({ ...r, [p._id]: { ...r[p._id], comment: e.target.value } }))}
                          />
                          <button
                            onClick={() => handleReview(p._id)}
                            disabled={!rev.rating || rev.submitting}
                            className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                            {rev.submitting ? 'Submitting…' : 'Submit Review'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )
          }
        </section>
      </main>
    </div>
  );
}
