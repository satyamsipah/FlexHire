import { useEffect } from 'react';
import ShowcaseLayout from '../components/ShowcaseLayout.jsx';

/* ── reusable diagram primitives ── */
function Box({ label, sub, color = 'gray' }) {
  const colors = {
    indigo: 'border-indigo-300 bg-indigo-50 text-indigo-800',
    emerald: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-300 bg-amber-50 text-amber-800',
    blue: 'border-blue-300 bg-blue-50 text-blue-800',
    rose: 'border-rose-300 bg-rose-50 text-rose-800',
    violet: 'border-violet-300 bg-violet-50 text-violet-800',
    gray: 'border-gray-300 bg-gray-50 text-gray-800',
  };
  return (
    <div className={`rounded-lg border px-4 py-2 text-center ${colors[color]}`}>
      <div className="text-sm font-semibold">{label}</div>
      {sub && <div className="text-xs opacity-70">{sub}</div>}
    </div>
  );
}

function Arrow({ vertical = false }) {
  return vertical
    ? <div className="flex justify-center text-gray-400 text-lg leading-none py-1">↓</div>
    : <div className="text-gray-400 text-lg leading-none px-1 self-center">→</div>;
}

function SectionTitle({ children }) {
  return <h2 className="mb-6 text-xl font-bold text-gray-900">{children}</h2>;
}

/* ── milestone state colour map ── */
const STATE_COLORS = {
  CREATED:      'gray',
  FUNDED:       'amber',
  IN_PROGRESS:  'blue',
  SUBMITTED:    'violet',
  APPROVED:     'emerald',
  DISPUTED:     'rose',
  REFUNDED:     'amber',
  AUTO_REFUNDED: 'amber',
  CANCELLED:    'gray',
};

/* 9 real transitions from MilestoneStateMachine.js */
const TRANSITIONS = [
  { from: 'CREATED',     to: 'FUNDED',        trigger: 'Razorpay webhook (payment.captured)' },
  { from: 'FUNDED',      to: 'IN_PROGRESS',   trigger: 'Freelancer clicks "Start Work"' },
  { from: 'IN_PROGRESS', to: 'SUBMITTED',      trigger: 'Freelancer submits with note' },
  { from: 'SUBMITTED',   to: 'APPROVED',       trigger: 'Client approves — payout triggered' },
  { from: 'SUBMITTED',   to: 'DISPUTED',       trigger: 'Client or freelancer raises dispute' },
  { from: 'DISPUTED',    to: 'APPROVED',       trigger: 'Admin resolves: approve (payout)' },
  { from: 'DISPUTED',    to: 'REFUNDED',       trigger: 'Admin resolves: refund (Razorpay refund)' },
  { from: 'CREATED',     to: 'CANCELLED',      trigger: 'Client cancels before payment' },
  { from: 'FUNDED',      to: 'AUTO_REFUNDED',  trigger: 'Admin: freelancer unresponsive' },
];

/* 6 real Mongoose models (User, Project, Message, Dispute, AuditLog, Review) */
const MODELS = [
  {
    name: 'User',
    color: 'indigo',
    fields: ['name, email, password (bcrypt)', 'role: client | freelancer | admin', 'walletBalance, isGuest', 'razorpayContactId, razorpayFundAccountId'],
  },
  {
    name: 'Project',
    color: 'blue',
    fields: ['clientId → User', 'freelancerId → User', 'title, description, totalBudget', 'state: POSTED|ACCEPTED|IN_PROGRESS|COMPLETED|CANCELLED', '★ milestones: [MilestoneSchema] (embedded)'],
    note: 'Milestones are embedded subdocuments — not a separate collection',
  },
  {
    name: 'Milestone (subdoc)',
    color: 'violet',
    fields: ['title, description, amount', 'state: 9-value enum', 'razorpayOrderId, razorpayPaymentId, razorpayPayoutId', 'submissionNote, submittedAt, approvedAt, refundedAt'],
    note: 'Lives inside Project.milestones — accessed via project.milestones.id(id)',
  },
  {
    name: 'Message',
    color: 'emerald',
    fields: ['projectId → Project', 'senderId → User', 'content: String', 'attachments: [String] (Cloudinary URLs)'],
  },
  {
    name: 'Dispute',
    color: 'rose',
    fields: ['milestoneId (subdoc _id)', 'raisedBy → User', 'reason, resolution', 'resolvedBy → User, resolvedAt'],
  },
  {
    name: 'AuditLog',
    color: 'amber',
    fields: ['userId → User', 'action: String (e.g. MILESTONE_FUNDED)', 'entityType, entityId', 'metadata: Mixed, timestamp'],
    note: 'Written inside every state-machine transaction',
  },
  {
    name: 'Review',
    color: 'gray',
    fields: ['projectId → Project (compound unique index)', 'fromUserId → User', 'toUserId → User', 'rating: 1–5, comment: String'],
    note: 'Mutual reviews unlock after project completion',
  },
];

export default function Architecture() {
  useEffect(() => { document.title = 'Architecture — FlexHire'; }, []);

  return (
    <ShowcaseLayout>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-500">Technical Deep-Dive</p>
        <h1 className="mb-4 text-4xl font-extrabold text-gray-900">System Architecture</h1>
        <p className="mb-12 max-w-2xl text-lg text-gray-600">
          Every diagram on this page is derived directly from the source code — no hand-wavy blocks.
        </p>

        {/* ── 1. High-level system ── */}
        <section className="mb-16">
          <SectionTitle>High-level System</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-6">
            {/* Row 1: main request path */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Box label="React 19 + Vite" sub="Zustand · react-router-dom v7" color="indigo" />
              <Arrow />
              <Box label="Axios (REST)" sub="withCredentials: true" color="gray" />
              <Arrow />
              <Box label="Express API" sub="Node.js 20, port 5001" color="blue" />
              <Arrow />
              <Box label="Mongoose 8" sub="ODM layer" color="gray" />
              <Arrow />
              <Box label="MongoDB Atlas" sub="3-node replica set" color="emerald" />
            </div>

            {/* Row 2: side integrations */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-center">
                <div className="text-sm font-semibold text-violet-800">Socket.io 4</div>
                <div className="text-xs text-violet-600">/chat namespace · Redis adapter</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                <div className="text-sm font-semibold text-amber-800">Razorpay</div>
                <div className="text-xs text-amber-600">Orders · Webhooks · Payouts (mocked)</div>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-center">
                <div className="text-sm font-semibold text-sky-800">Cloudinary</div>
                <div className="text-xs text-sky-600">multer · CloudinaryStorage</div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
                <div className="text-sm font-semibold text-rose-800">Upstash Redis</div>
                <div className="text-xs text-rose-600">Socket.io adapter · TLS (rediss://)</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Auth flow ── */}
        <section className="mb-16">
          <SectionTitle>Auth Flow</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-6">
            <div className="flex flex-wrap items-start justify-center gap-2">
              <Box label="POST /api/auth/login" sub="email + password" color="indigo" />
              <Arrow />
              <Box label="bcrypt.compare()" sub="12-round hash" color="gray" />
              <Arrow />
              <Box label="jwt.sign()" sub="{ userId, role, isGuest }" color="blue" />
              <Arrow />
              <Box label="httpOnly cookie" sub="secure + sameSite:none in prod" color="amber" />
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-center gap-2">
              <Box label="ProtectedRoute" sub="calls GET /api/auth/me" color="violet" />
              <Arrow />
              <Box label="requireAuth middleware" sub="verifies cookie JWT" color="gray" />
              <Arrow />
              <Box label="Role-gated route" sub="client | freelancer | admin" color="emerald" />
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>httpOnly means JS cannot read the cookie.</strong> Socket.io auth reads it server-side from{' '}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">socket.handshake.headers.cookie</code>{' '}
              using the <code className="rounded bg-amber-100 px-1 font-mono text-xs">cookie</code> package.
            </div>
          </div>
        </section>

        {/* ── 3. Milestone state machine ── */}
        <section className="mb-16">
          <SectionTitle>Milestone Escrow State Machine</SectionTitle>
          <p className="mb-4 text-sm text-gray-600">
            9 states · 9 transitions · all wrapped in MongoDB transactions · AuditLog written on every transition.
          </p>

          {/* Happy path */}
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Happy path</p>
            <div className="flex flex-wrap items-center gap-2">
              {['CREATED', 'FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'].map((s, i, arr) => (
                <div key={s} className="flex items-center gap-2">
                  <Box label={s} color={STATE_COLORS[s]} />
                  {i < arr.length - 1 && <Arrow />}
                </div>
              ))}
            </div>

            <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Branch paths</p>
            <div className="flex flex-wrap gap-3">
              {[
                { states: ['SUBMITTED', 'DISPUTED', 'APPROVED'], label: 'dispute → admin approve' },
                { states: ['SUBMITTED', 'DISPUTED', 'REFUNDED'], label: 'dispute → admin refund' },
                { states: ['CREATED', 'CANCELLED'], label: 'client cancels' },
                { states: ['FUNDED', 'AUTO_REFUNDED'], label: 'admin auto-refund' },
              ].map(({ states, label }) => (
                <div key={label} className="flex-1 min-w-fit rounded-lg border border-gray-200 bg-white p-3">
                  <div className="mb-1 text-xs text-gray-500">{label}</div>
                  <div className="flex flex-wrap items-center gap-1">
                    {states.map((s, i, arr) => (
                      <div key={s} className="flex items-center gap-1">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          STATE_COLORS[s] === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
                          STATE_COLORS[s] === 'amber'   ? 'bg-amber-100 text-amber-800' :
                          STATE_COLORS[s] === 'rose'    ? 'bg-rose-100 text-rose-800' :
                          STATE_COLORS[s] === 'violet'  ? 'bg-violet-100 text-violet-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>{s}</span>
                        {i < arr.length - 1 && <span className="text-gray-400">→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Transitions table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 text-left font-semibold text-gray-700">From</th>
                    <th className="py-2 text-left font-semibold text-gray-700">To</th>
                    <th className="py-2 text-left font-semibold text-gray-700">Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {TRANSITIONS.map((t) => (
                    <tr key={`${t.from}-${t.to}`} className="border-b border-gray-100">
                      <td className="py-2 font-mono text-xs text-gray-700">{t.from}</td>
                      <td className="py-2 font-mono text-xs text-gray-700">{t.to}</td>
                      <td className="py-2 text-gray-600">{t.trigger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── 4. Real-time messaging ── */}
        <section className="mb-16">
          <SectionTitle>Real-time Messaging</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Box label="Browser" sub="socket.io-client" color="indigo" />
              <Arrow />
              <Box label="/chat namespace" sub="cookie-authed via socketAuth" color="violet" />
              <Arrow />
              <Box label="Server joins" sub="project:{id} room" color="blue" />
              <Arrow />
              <Box label="Redis pub/sub" sub="@socket.io/redis-adapter" color="rose" />
              <Arrow />
              <Box label="Other party" sub="real-time delivery" color="emerald" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { event: 'join_project', dir: '→ server', desc: 'Subscribe to project room (membership verified)' },
                { event: 'message:send', dir: '→ server', desc: 'Persist to MongoDB + broadcast to room' },
                { event: 'message:typing', dir: '→ server', desc: 'Relay typing indicator (not persisted)' },
                { event: 'message:new', dir: '← client', desc: 'Populated message (senderId populated)' },
                { event: 'user:joined', dir: '← client', desc: 'Presence signal on room join' },
                { event: 'user:left', dir: '← client', desc: 'Presence signal on disconnect' },
              ].map((e) => (
                <div key={e.event} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs font-mono text-indigo-700">{e.event}</code>
                    <span className="text-xs text-gray-400">{e.dir}</span>
                  </div>
                  <div className="text-xs text-gray-600">{e.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
              Route handlers also call <code className="rounded bg-violet-100 px-1 font-mono text-xs">emitToProject(projectId, event, data)</code> after
              milestone state transitions — so both parties see escrow status updates in real time without polling.
            </div>
          </div>
        </section>

        {/* ── 5. Data model ── */}
        <section className="mb-8">
          <SectionTitle>Data Model</SectionTitle>
          <p className="mb-4 text-sm text-gray-600">
            6 Mongoose models · milestones are <strong>embedded subdocuments</strong> inside Project (not a separate collection) — a deliberate design choice that keeps the escrow transaction atomic.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODELS.map((m) => {
              const headerColors = {
                indigo: 'bg-indigo-600',
                blue: 'bg-blue-600',
                violet: 'bg-violet-600',
                emerald: 'bg-emerald-600',
                rose: 'bg-rose-600',
                amber: 'bg-amber-500',
                gray: 'bg-gray-500',
              };
              return (
                <div key={m.name} className="rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className={`${headerColors[m.color]} px-4 py-2`}>
                    <span className="font-semibold text-white text-sm">{m.name}</span>
                  </div>
                  <div className="p-4">
                    <ul className="space-y-1">
                      {m.fields.map((f) => (
                        <li key={f} className="text-xs text-gray-700 font-mono leading-relaxed">{f}</li>
                      ))}
                    </ul>
                    {m.note && (
                      <p className="mt-3 text-xs italic text-gray-500">{m.note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </ShowcaseLayout>
  );
}
