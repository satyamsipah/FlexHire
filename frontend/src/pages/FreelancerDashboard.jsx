import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';

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

export default function FreelancerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [projects,   setProjects]   = useState([]);
  const [accepting,  setAccepting]  = useState(null);
  const [acting,     setActing]     = useState(null);
  const [error,      setError]      = useState('');
  const [notes,      setNotes]      = useState({});
  const [submitting, setSubmitting] = useState({});
  const [reviews,    setReviews]    = useState({});

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/api/projects');
      setProjects(data.projects);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

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

  async function handleAccept(projectId) {
    setError('');
    setAccepting(projectId);
    try {
      await api.post(`/api/projects/${projectId}/accept`);
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not accept project');
    } finally {
      setAccepting(null);
    }
  }

  async function handleStart(milestoneId) {
    setError('');
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/start`);
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not start milestone');
    } finally {
      setActing(null);
    }
  }

  async function handleSubmit(milestoneId) {
    setError('');
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/submit`, {
        submissionNote: notes[milestoneId] ?? '',
      });
      setSubmitting(s => ({ ...s, [milestoneId]: false }));
      setNotes(n => ({ ...n, [milestoneId]: '' }));
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not submit milestone');
    } finally {
      setActing(null);
    }
  }

  async function handleDispute(milestoneId) {
    const reason = window.prompt('Describe the issue (min 10 characters):');
    if (!reason?.trim()) return;
    setError('');
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/dispute`, { reason });
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not raise dispute');
    } finally {
      setActing(null);
    }
  }

  async function handleReview(projectId) {
    const rev = reviews[projectId] ?? {};
    if (!rev.rating) return;
    setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: true } }));
    try {
      await api.post(`/api/reviews/${projectId}`, { rating: rev.rating, comment: rev.comment ?? '' });
      setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: false, submitted: true } }));
    } catch (err) {
      setError(err.response?.data?.error ?? 'Review failed');
      setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: false } }));
    }
  }

  const postedProjects   = projects.filter(p => p.state === 'POSTED');
  const acceptedProjects = projects.filter(p => p.state !== 'POSTED');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.name}{' '}
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">freelancer</span>
          </span>
          <button onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6 space-y-8">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* ── Open marketplace ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Open Projects</h2>
          {postedProjects.length === 0
            ? <p className="text-sm text-gray-500">No open projects right now.</p>
            : (
              <div className="space-y-3">
                {postedProjects.map(p => (
                  <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{p.title}</h3>
                        <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>
                        <div className="mt-2 flex gap-4 text-xs text-gray-400">
                          <span>Budget: ₹{p.totalBudget.toLocaleString()}</span>
                          <span>{p.milestones.length} milestone{p.milestones.length !== 1 ? 's' : ''}</span>
                        </div>
                        {p.milestones.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {p.milestones.map(m => (
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
                        className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                        {accepting === p._id ? 'Accepting…' : 'Accept'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </section>

        {/* ── My active projects ── */}
        {acceptedProjects.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">My Active Projects</h2>
            <div className="space-y-4">
              {acceptedProjects.map(p => (
                <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{p.title}</h3>
                      <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>
                    </div>
                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {p.state}
                      </span>
                      <Link
                        to={`/project/${p._id}/chat`}
                        className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        Chat
                      </Link>
                    </div>
                  </div>

                  {/* Milestone rows */}
                  {p.milestones.length > 0 && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {p.milestones.map(m => (
                        <div key={m._id} className="rounded-lg bg-gray-50 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${M_STATE_STYLES[m.state] ?? ''}`}>
                                {m.state}
                              </span>
                              <span className="truncate text-sm font-medium text-gray-800">{m.title}</span>
                              <span className="shrink-0 text-xs text-gray-400">₹{m.amount.toLocaleString()}</span>
                            </div>

                            <div className="ml-3 flex shrink-0 gap-2">
                              {m.state === 'FUNDED' && (
                                <button
                                  onClick={() => handleStart(m._id)}
                                  disabled={acting === m._id}
                                  className="rounded bg-yellow-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-50">
                                  {acting === m._id ? '…' : 'Start Work'}
                                </button>
                              )}
                              {m.state === 'IN_PROGRESS' && !submitting[m._id] && (
                                <button
                                  onClick={() => setSubmitting(s => ({ ...s, [m._id]: true }))}
                                  className="rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600">
                                  Submit Work
                                </button>
                              )}
                              {m.state === 'SUBMITTED' && (
                                <button
                                  onClick={() => handleDispute(m._id)}
                                  disabled={acting === m._id}
                                  className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                                  Dispute
                                </button>
                              )}
                              {m.state === 'DISPUTED' && (
                                <span className="text-xs text-red-600 italic">Awaiting admin</span>
                              )}
                            </div>
                          </div>

                          {/* Inline submit form */}
                          {m.state === 'IN_PROGRESS' && submitting[m._id] && (
                            <div className="mt-2 space-y-2">
                              <textarea
                                rows={2}
                                placeholder="Describe what you completed (optional)"
                                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400"
                                value={notes[m._id] ?? ''}
                                onChange={e => setNotes(n => ({ ...n, [m._id]: e.target.value }))}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSubmit(m._id)}
                                  disabled={acting === m._id}
                                  className="rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                                  {acting === m._id ? 'Submitting…' : 'Confirm submit'}
                                </button>
                                <button
                                  onClick={() => setSubmitting(s => ({ ...s, [m._id]: false }))}
                                  className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {m.state === 'SUBMITTED' && m.submissionNote && (
                            <p className="mt-1 text-xs italic text-gray-500">
                              Submitted: "{m.submissionNote}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review prompt for completed projects */}
                  {p.state === 'COMPLETED' && (() => {
                    const rev = reviews[p._id] ?? {};
                    if (rev.submitted) {
                      return <p className="mt-3 border-t pt-3 text-xs text-emerald-600">✓ You've rated this project</p>;
                    }
                    return (
                      <div className="mt-3 border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-700">Rate your experience with the client:</p>
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
          </section>
        )}
      </main>
    </div>
  );
}
