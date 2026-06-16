import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { formatINR, timeAgo } from '../lib/format.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import GuestBanner from '../components/GuestBanner.jsx';

// ── Badge colours ─────────────────────────────────────────────────────────────
const PROJECT_BADGE = {
  POSTED:      'bg-yellow-100 text-yellow-800',
  ACCEPTED:    'bg-blue-100  text-blue-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED:   'bg-green-100 text-green-800',
  CANCELLED:   'bg-red-100   text-red-800',
};
const M_BADGE = {
  CREATED:       'bg-gray-100   text-gray-700',
  FUNDED:        'bg-blue-100   text-blue-700',
  IN_PROGRESS:   'bg-yellow-100 text-yellow-800',
  SUBMITTED:     'bg-orange-100 text-orange-800',
  APPROVED:      'bg-green-100  text-green-800',
  DISPUTED:      'bg-red-100    text-red-800',
  REFUNDED:      'bg-rose-200   text-rose-900',
  AUTO_REFUNDED: 'bg-purple-100 text-purple-800',
  CANCELLED:     'bg-slate-100  text-slate-600',
};

const EMPTY_FORM      = { title: '', description: '', totalBudget: '' };
const EMPTY_MILESTONE = { title: '', description: '', amount: '' };

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProjectSkeleton() {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm animate-pulse space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-2/3 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
          <div className="h-3 w-1/4 rounded bg-gray-200" />
        </div>
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="border-t pt-3 space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <div className="flex gap-3">
              <div className="h-5 w-16 rounded-full bg-gray-200" />
              <div className="h-5 w-28 rounded bg-gray-200" />
            </div>
            <div className="h-7 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Star rating ───────────────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`text-xl leading-none ${n <= value ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400`}>
          ★
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [projects,   setProjects]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [milestones, setMilestones] = useState([]);
  const [formError,  setFormError]  = useState('');
  const [creating,   setCreating]   = useState(false);
  const [acting,     setActing]     = useState(null);
  // { type: 'dispute'|'cancel', milestoneId }
  const [modal,      setModal]      = useState(null);
  // { [projectId]: { rating, comment, submitting, submitted } }
  const [reviews,    setReviews]    = useState({});

  // ── Data fetching ────────────────────────────────────────────────────────────
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
    projects
      .filter(p => p.state === 'COMPLETED')
      .forEach(p => {
        api.get(`/api/reviews/${p._id}/mine`)
          .then(({ data }) => {
            if (data.review)
              setReviews(r => ({ ...r, [p._id]: { ...r[p._id], submitted: true } }));
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
  function addMilestone()       { setMilestones(m => [...m, { ...EMPTY_MILESTONE }]); }
  function removeMilestone(idx) { setMilestones(m => m.filter((_, i) => i !== idx)); }
  function updateMilestone(idx, field, value) {
    setMilestones(m => m.map((item, i) => i === idx ? { ...item, [field]: value } : item));
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
      toast.success('Project posted!');
      fetchProjects();
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Failed to create project';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }

  // ── Milestone actions ────────────────────────────────────────────────────────
  async function handleFund(milestoneId) {
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
          toast.success('Payment submitted! Milestone will fund in seconds.');
          fetchProjects();
        },
        modal: { ondismiss: () => setActing(null) },
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not initiate payment');
      setActing(null);
    }
  }

  async function handleApprove(milestoneId) {
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/approve`);
      toast.success('Milestone approved — payment released!');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Approval failed');
    } finally {
      setActing(null);
    }
  }

  async function handleDispute(reason) {
    const { milestoneId } = modal;
    setModal(null);
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/dispute`, { reason });
      toast.success('Dispute raised — admin will review shortly.');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not raise dispute');
    } finally {
      setActing(null);
    }
  }

  async function handleCancel() {
    const { milestoneId } = modal;
    setModal(null);
    setActing(milestoneId);
    try {
      await api.post(`/api/milestones/${milestoneId}/cancel`);
      toast.success('Milestone cancelled.');
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Could not cancel milestone');
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
      toast.success('Review submitted!');
      setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: false, submitted: true } }));
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Review failed');
      setReviews(r => ({ ...r, [projectId]: { ...r[projectId], submitting: false } }));
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <GuestBanner />

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 sm:px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire</h1>
        <div className="flex items-center gap-3 flex-wrap">
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

      <main className="mx-auto max-w-4xl p-4 sm:p-6 space-y-8">

        {/* ── Create project form ── */}
        <section className="rounded-xl bg-white p-5 sm:p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Post a New Project</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea required rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Total budget</label>
              <input required type="number" min="1"
                className="mt-1 w-full sm:w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="₹"
                value={form.totalBudget} onChange={e => setForm({ ...form, totalBudget: e.target.value })} />
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input required placeholder="Title"
                        className="sm:col-span-2 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.title} onChange={e => updateMilestone(idx, 'title', e.target.value)} />
                      <input required type="number" min="1" placeholder="Amount (₹)"
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                        value={m.amount} onChange={e => updateMilestone(idx, 'amount', e.target.value)} />
                      <input required placeholder="Description"
                        className="sm:col-span-3 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
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

        {/* ── My projects ── */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">My Projects</h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <ProjectSkeleton key={i} />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <p className="text-gray-400 text-sm">No projects yet — post your first one above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map(p => (
                <div key={p._id} className="rounded-xl border bg-white p-4 shadow-sm">
                  {/* Project header */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{p.title}</h3>
                      <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{p.description}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>{formatINR(p.totalBudget)}</span>
                        <span>{p.milestones.length} milestone{p.milestones.length !== 1 ? 's' : ''}</span>
                        {p.createdAt && <span>{timeAgo(p.createdAt)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PROJECT_BADGE[p.state] ?? ''}`}>
                        {p.state}
                      </span>
                      {p.state !== 'POSTED' && (
                        <Link to={`/project/${p._id}/chat`}
                          className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                          Chat
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Milestone rows */}
                  {p.milestones.length > 0 && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {p.milestones.map(m => (
                        <div key={m._id} className="rounded-lg bg-gray-50 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${M_BADGE[m.state] ?? ''}`}>
                                {m.state}
                              </span>
                              <span className="truncate text-sm font-medium text-gray-800">{m.title}</span>
                              <span className="shrink-0 text-xs text-gray-400">{formatINR(m.amount)}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {m.state === 'CREATED' && (
                                <>
                                  {/* title lives on the wrapper span — a disabled
                                      button doesn't fire hover events on its own */}
                                  <span
                                    className="inline-block"
                                    title={user?.isGuest ? 'Disabled in demo mode — no real payments' : undefined}>
                                    <button
                                      onClick={() => handleFund(m._id)}
                                      disabled={acting === m._id || user?.isGuest}
                                      className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                                      {acting === m._id ? '…' : 'Fund'}
                                    </button>
                                  </span>
                                  <button
                                    onClick={() => setModal({ type: 'cancel', milestoneId: m._id })}
                                    disabled={acting === m._id}
                                    className="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                                    Cancel
                                  </button>
                                </>
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
                                    onClick={() => setModal({ type: 'dispute', milestoneId: m._id })}
                                    disabled={acting === m._id}
                                    className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                                    Dispute
                                  </button>
                                  {m.submissionNote && (
                                    <span className="max-w-[160px] truncate text-xs italic text-gray-500" title={m.submissionNote}>
                                      "{m.submissionNote}"
                                    </span>
                                  )}
                                </>
                              )}
                              {m.state === 'DISPUTED' && (
                                <span className="text-xs text-red-500 italic">Awaiting admin resolution</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Review prompt for completed projects */}
                  {p.state === 'COMPLETED' && (() => {
                    const rev = reviews[p._id] ?? {};
                    if (rev.submitted) {
                      return <p className="mt-3 border-t pt-3 text-xs text-emerald-600">✓ Review submitted</p>;
                    }
                    return (
                      <div className="mt-3 border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-700">Rate your experience with the freelancer:</p>
                        <StarRating value={rev.rating ?? 0}
                          onChange={n => setReviews(r => ({ ...r, [p._id]: { ...r[p._id], rating: n } }))} />
                        <textarea rows={2} placeholder="Optional comment…"
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                          value={rev.comment ?? ''}
                          onChange={e => setReviews(r => ({ ...r, [p._id]: { ...r[p._id], comment: e.target.value } }))} />
                        <button onClick={() => handleReview(p._id)} disabled={!rev.rating || rev.submitting}
                          className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                          {rev.submitting ? 'Submitting…' : 'Submit Review'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Dispute modal */}
      {modal?.type === 'dispute' && (
        <ConfirmModal
          title="Raise a dispute"
          message="The milestone will be locked and reviewed by an admin."
          confirmText="Raise dispute"
          destructive
          withReason
          reasonLabel="Describe the issue"
          onConfirm={handleDispute}
          onClose={() => setModal(null)}
        />
      )}

      {/* Cancel modal */}
      {modal?.type === 'cancel' && (
        <ConfirmModal
          title="Cancel milestone"
          message="This will permanently cancel the milestone. The client will not be charged."
          confirmText="Yes, cancel"
          destructive
          onConfirm={handleCancel}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
