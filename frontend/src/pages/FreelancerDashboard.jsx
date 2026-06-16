import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import GuestBanner from '../components/GuestBanner.jsx';
import { formatINR, timeAgo } from '../lib/format.js';

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

function ProjectSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="h-3 w-64 rounded bg-gray-100" />
          <div className="flex gap-4">
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="h-3 w-16 rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-8 w-20 shrink-0 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

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
  const [loading,    setLoading]    = useState(true);
  const [accepting,  setAccepting]  = useState(null);
  const [acting,     setActing]     = useState(null);
  const [notes,      setNotes]      = useState({});
  const [submitting, setSubmitting] = useState({});
  const [reviews,    setReviews]    = useState({});
  const [modal,      setModal]      = useState(null); // { milestoneId }

  const fetchProjects = useCallback(async () => {
    try {
      const { data } = await api.get('/api/projects');
      setProjects(data.projects);
    } catch {
      toast.error('Could not load projects');
    } finally {
      setLoading(false);
    }
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
    setAccepting(projectId);
    try {
      await api.post(`/api/projects/${projectId}/accept`);
      toast.success('Project accepted!');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not accept project');
    } finally {
      setAccepting(null);
    }
  }

  async function handleStart(milestoneId) {
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/start`);
      toast.success('Work started!');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not start milestone');
    } finally {
      setActing(null);
    }
  }

  async function handleSubmit(milestoneId) {
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/submit`, {
        submissionNote: notes[milestoneId] ?? '',
      });
      setSubmitting(s => ({ ...s, [milestoneId]: false }));
      setNotes(n => ({ ...n, [milestoneId]: '' }));
      toast.success('Work submitted for review!');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not submit milestone');
    } finally {
      setActing(null);
    }
  }

  async function handleDisputeConfirm(reason) {
    const { milestoneId } = modal;
    setModal(null);
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/dispute`, { reason });
      toast.success('Dispute raised — admin will review shortly');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not raise dispute');
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
      toast.success('Review submitted!');
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Review failed');
      setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: false } }));
    }
  }

  const postedProjects   = projects.filter(p => p.state === 'POSTED');
  const acceptedProjects = projects.filter(p => p.state !== 'POSTED');

  return (
    <div className="min-h-screen bg-gray-50">
      <GuestBanner />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.name}{' '}
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">freelancer</span>
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4 sm:p-6 space-y-8">

        {/* ── Open marketplace ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Open Projects</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <ProjectSkeleton key={i} />)}
            </div>
          ) : postedProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-gray-500">No open projects right now.</p>
              <p className="mt-1 text-xs text-gray-400">Check back later for new opportunities.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {postedProjects.map(p => (
                <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{p.title}</h3>
                      <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{p.description}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>Budget: {formatINR(p.totalBudget)}</span>
                        <span>{p.milestones.length} milestone{p.milestones.length !== 1 ? 's' : ''}</span>
                        {p.createdAt && <span>Posted {timeAgo(p.createdAt)}</span>}
                      </div>
                      {p.milestones.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {p.milestones.map(m => (
                            <li key={m._id} className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="font-medium">{m.title}</span>
                              <span className="text-gray-400">—</span>
                              <span>{formatINR(m.amount)}</span>
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
        </section>

        {/* ── My active projects ── */}
        {!loading && acceptedProjects.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">My Active Projects</h2>
            <div className="space-y-4">
              {acceptedProjects.map(p => (
                <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900">{p.title}</h3>
                      <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{p.description}</p>
                      {p.createdAt && (
                        <p className="mt-1 text-xs text-gray-400">Started {timeAgo(p.createdAt)}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {p.state}
                      </span>
                      <Link
                        to={`/project/${p._id}/chat`}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
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
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${M_STATE_STYLES[m.state] ?? ''}`}>
                                {m.state}
                              </span>
                              <span className="truncate text-sm font-medium text-gray-800">{m.title}</span>
                              <span className="shrink-0 text-xs text-gray-400">{formatINR(m.amount)}</span>
                            </div>

                            <div className="flex shrink-0 gap-2">
                              {m.state === 'FUNDED' && (
                                <button
                                  onClick={() => handleStart(m._id)}
                                  disabled={acting === m._id}
                                  className="rounded bg-yellow-500 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                                >
                                  {acting === m._id ? '…' : 'Start Work'}
                                </button>
                              )}
                              {m.state === 'IN_PROGRESS' && !submitting[m._id] && (
                                <button
                                  onClick={() => setSubmitting(s => ({ ...s, [m._id]: true }))}
                                  className="rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600"
                                >
                                  Submit Work
                                </button>
                              )}
                              {m.state === 'SUBMITTED' && (
                                <button
                                  onClick={() => setModal({ milestoneId: m._id })}
                                  disabled={acting === m._id}
                                  className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  Dispute
                                </button>
                              )}
                              {m.state === 'DISPUTED' && (
                                <span className="text-xs italic text-red-600">Awaiting admin</span>
                              )}
                            </div>
                          </div>

                          {/* Inline submit form */}
                          {m.state === 'IN_PROGRESS' && submitting[m._id] && (
                            <div className="mt-2 space-y-2">
                              <textarea
                                rows={2}
                                placeholder="Describe what you completed (optional)"
                                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                                value={notes[m._id] ?? ''}
                                onChange={e => setNotes(n => ({ ...n, [m._id]: e.target.value }))}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSubmit(m._id)}
                                  disabled={acting === m._id}
                                  className="rounded bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {acting === m._id ? 'Submitting…' : 'Confirm submit'}
                                </button>
                                <button
                                  onClick={() => setSubmitting(s => ({ ...s, [m._id]: false }))}
                                  className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                                >
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
                      return (
                        <p className="mt-3 border-t pt-3 text-xs text-emerald-600">
                          ✓ You've rated this project
                        </p>
                      );
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
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
                          value={rev.comment ?? ''}
                          onChange={e => setReviews(r => ({ ...r, [p._id]: { ...r[p._id], comment: e.target.value } }))}
                        />
                        <button
                          onClick={() => handleReview(p._id)}
                          disabled={!rev.rating || rev.submitting}
                          className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
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

      {modal && (
        <ConfirmModal
          title="Raise a dispute"
          confirmText="Raise dispute"
          withReason
          reasonLabel="Describe the issue"
          onConfirm={handleDisputeConfirm}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
