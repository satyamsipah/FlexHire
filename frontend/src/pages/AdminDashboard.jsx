import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import useAuthStore from '../store/authStore.js';
import { formatINR, timeAgo } from '../lib/format.js';

const M_STATE_STYLES = {
  DISPUTED: 'bg-red-100 text-red-800',
  APPROVED: 'bg-green-100 text-green-800',
  REFUNDED: 'bg-rose-200 text-rose-900',
};

function DisputeSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="h-3 w-64 rounded bg-gray-100" />
          <div className="flex gap-4">
            <div className="h-3 w-24 rounded bg-gray-100" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
          <div className="h-3 w-full rounded bg-gray-100" />
        </div>
        <div className="h-9 w-20 shrink-0 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

function ResolveModal({ dispute, onClose, onResolved }) {
  const [resolution, setResolution] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit() {
    if (!resolution) return;
    setSubmitting(true);
    setErr('');
    try {
      await api.post(`/api/disputes/${dispute._id}/resolve`, { resolution });
      toast.success(resolution === 'approve' ? 'Dispute resolved — payment released' : 'Dispute resolved — refund issued');
      onResolved();
    } catch (e) {
      setErr(e.response?.data?.error ?? 'Resolution failed');
      toast.error(e.response?.data?.error ?? 'Resolution failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">Resolve Dispute</h3>
        <p className="mb-4 text-sm text-gray-500">
          <b>{dispute.milestone?.title}</b>
          {dispute.milestone?.amount != null && ` — ${formatINR(dispute.milestone.amount)}`}
          <br />{dispute.project?.title}
        </p>

        <div className="mb-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          <p className="mb-1 text-xs font-semibold text-gray-500">Dispute reason</p>
          {dispute.reason}
        </div>

        {dispute.milestone?.submissionNote && (
          <div className="mb-4 rounded-lg bg-orange-50 p-3 text-sm text-gray-700">
            <p className="mb-1 text-xs font-semibold text-gray-500">Freelancer's submission note</p>
            {dispute.milestone.submissionNote}
          </div>
        )}

        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Resolution</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
            <input type="radio" name="resolution" value="approve" checked={resolution === 'approve'}
              onChange={() => setResolution('approve')} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-700">Resolve for Freelancer (Approve + Payout)</p>
              <p className="text-xs text-gray-500">Approve the work and release payment to freelancer's wallet.</p>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
            <input type="radio" name="resolution" value="refund" checked={resolution === 'refund'}
              onChange={() => setResolution('refund')} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700">Resolve for Client (Refund)</p>
              <p className="text-xs text-gray-500">Refund the milestone amount to the client.</p>
            </div>
          </label>
        </div>

        {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!resolution || submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {submitting ? 'Resolving…' : 'Confirm Resolution'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [disputes,  setDisputes]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [resolving, setResolving] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [tab,       setTab]       = useState('disputes');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/disputes');
      setDisputes(data.disputes);
    } catch {
      toast.error('Could not load disputes');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const { data } = await api.get('/api/milestones/audit-logs');
      setAuditLogs(data.logs);
    } catch {
      toast.error('Could not load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  useEffect(() => {
    if (tab === 'audit') fetchAuditLogs();
  }, [tab, fetchAuditLogs]);

  async function handleLogout() {
    await api.post('/api/auth/logout');
    logout();
    navigate('/login', { replace: true });
  }

  const openDisputes     = disputes.filter(d => !d.resolvedAt);
  const resolvedDisputes = disputes.filter(d =>  d.resolvedAt);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-indigo-700">FlexHire — Admin</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {user?.name}{' '}
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">admin</span>
          </span>
          <button onClick={handleLogout}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
          {['disputes', 'audit'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'disputes'
                ? `Disputes${openDisputes.length ? ` (${openDisputes.length})` : ''}`
                : 'Audit Log'}
            </button>
          ))}
        </div>

        {/* ── Disputes tab ── */}
        {tab === 'disputes' && (
          <div className="space-y-6">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <DisputeSkeleton key={i} />)}
              </div>
            ) : (
              <>
                {openDisputes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                    <p className="text-gray-500">No open disputes</p>
                    <p className="mt-1 text-xs text-gray-400">The platform is running smoothly.</p>
                  </div>
                )}

                {openDisputes.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-base font-semibold text-gray-900">Open Disputes</h2>
                    <div className="space-y-3">
                      {openDisputes.map(d => (
                        <div key={d._id} className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-gray-900">{d.project?.title ?? 'Unknown project'}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${M_STATE_STYLES.DISPUTED}`}>
                                  DISPUTED
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-gray-500">
                                Milestone: <b>{d.milestone?.title}</b>
                                {d.milestone?.amount != null && ` — ${formatINR(d.milestone.amount)}`}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                                <span>Client: {d.project?.clientId?.name ?? '—'}</span>
                                <span>Freelancer: {d.project?.freelancerId?.name ?? '—'}</span>
                                <span>Raised by: {d.raisedBy?.name ?? '—'}</span>
                                {d.createdAt && <span>{timeAgo(d.createdAt)}</span>}
                              </div>
                              <p className="mt-2 text-sm text-gray-700">
                                <span className="font-medium text-gray-500">Reason: </span>{d.reason}
                              </p>
                              {d.milestone?.submissionNote && (
                                <p className="mt-1 text-xs italic text-gray-500">
                                  Submission note: "{d.milestone.submissionNote}"
                                </p>
                              )}
                              {d.project && (
                                <Link
                                  to={`/project/${d.project._id}/chat`}
                                  className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                                >
                                  View chat history →
                                </Link>
                              )}
                            </div>
                            <button
                              onClick={() => setResolving(d)}
                              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {resolvedDisputes.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-base font-semibold text-gray-400">Resolved Disputes</h2>
                    <div className="space-y-2">
                      {resolvedDisputes.map(d => (
                        <div key={d._id} className="rounded-xl border bg-gray-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-700">{d.project?.title}</span>
                              <span className="ml-2 text-xs text-gray-500">— {d.milestone?.title}</span>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.resolution === 'approve' ? M_STATE_STYLES.APPROVED : M_STATE_STYLES.REFUNDED
                            }`}>
                              {d.resolution === 'approve' ? 'APPROVED' : 'REFUNDED'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">
                            Resolved by {d.resolvedBy?.name ?? 'admin'} · {d.resolvedAt ? timeAgo(d.resolvedAt) : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Audit log tab ── */}
        {tab === 'audit' && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Last 100 Audit Events</h2>
            {auditLoading ? (
              <div className="space-y-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 rounded-lg border bg-white px-3 py-2">
                    <div className="h-3 w-32 rounded bg-gray-200" />
                    <div className="h-3 w-40 rounded bg-gray-100" />
                    <div className="h-3 w-24 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-gray-500">No audit events yet.</p>
            ) : (
              <div className="space-y-1">
                {auditLogs.map(log => (
                  <div key={log._id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-white px-3 py-2 text-xs">
                    <span className="w-36 shrink-0 text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                    <span className="font-mono font-semibold text-indigo-700">{log.action}</span>
                    <span className="text-gray-500">{log.userId?.name ?? 'webhook'}</span>
                    <span className="truncate text-gray-400 sm:ml-auto">
                      {JSON.stringify(log.metadata)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {resolving && (
        <ResolveModal
          dispute={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => { setResolving(null); fetchDisputes(); }}
        />
      )}
    </div>
  );
}
