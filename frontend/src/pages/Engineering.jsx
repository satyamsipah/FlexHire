import { useEffect } from 'react';
import ShowcaseLayout from '../components/ShowcaseLayout.jsx';

/* Every number here is derived from counting real route handlers, socket events,
   and model files in the backend source. */
const METRICS = [
  { value: '27', label: 'REST endpoints', detail: '5 auth · 5 projects · 10 milestones · 2 disputes · 1 webhook · 1 upload · 3 reviews' },
  { value: '21', label: 'Protected endpoints', detail: 'requireAuth middleware — JWT cookie verified on every request' },
  { value: '6',  label: 'Mongoose models', detail: 'User · Project · Message · Dispute · AuditLog · Review' },
  { value: '9',  label: 'Milestone states', detail: 'CREATED → FUNDED → IN_PROGRESS → SUBMITTED → APPROVED + 4 exit states' },
  { value: '9',  label: 'State transitions', detail: 'All wrapped in MongoDB sessions — atomic by design' },
  { value: '7',  label: 'Named socket events', detail: '3 client→server (join, send, typing) · 4 server→client (new, typing, joined, left)' },
];

const SECURITY = [
  {
    title: 'JWT in httpOnly Cookies',
    code: 'res.cookie("token", signToken(userId, role), { httpOnly: true, secure: true, sameSite: "none" })',
    desc: 'Tokens never touch JavaScript — XSS cannot steal them. In production the cookie is secure + sameSite:none for cross-origin Vercel ↔ Render. In development lax + no-secure avoids needing localhost HTTPS.',
    file: 'routes/auth.js',
  },
  {
    title: 'RBAC via requireAuth + requireRole',
    code: '[requireAuth, requireRole(ROLES.CLIENT), handler]',
    desc: 'requireAuth reads and verifies the JWT, attaches req.userId and req.userRole. requireRole checks the role — it must always follow requireAuth because it reads req.userRole. Role constants come from constants/roles.js, never hardcoded strings.',
    file: 'middleware/requireAuth.js · middleware/requireRole.js',
  },
  {
    title: 'Razorpay Webhook HMAC Verification',
    code: 'app.use("/api/webhooks", webhookRoutes); // BEFORE express.json()',
    desc: 'Razorpay HMAC verification needs the raw request body buffer. Once express.json() parses it, the buffer is gone. The webhook route is registered before the JSON middleware and uses express.raw() internally.',
    file: 'index.js · routes/webhooks.js',
  },
  {
    title: 'Scoped Audit Logging',
    code: 'await AuditLog.create([{ userId, action, entityType, entityId, metadata }], { session })',
    desc: 'Every milestone state transition writes an AuditLog entry inside the same MongoDB transaction. The log captures the actor, the action string (e.g. MILESTONE_APPROVED), and the before/after state metadata.',
    file: 'services/escrow/MilestoneStateMachine.js',
  },
  {
    title: 'Rate-limited Guest Endpoint',
    code: 'const guestLimiter = rateLimit({ windowMs: 60_000, max: 10 })',
    desc: 'The public POST /api/auth/guest endpoint is rate-limited to 10 requests per IP per minute using express-rate-limit. Normal login and signup are unaffected. Trust proxy is set to 1 so Render\'s forwarded IP is used.',
    file: 'routes/auth.js',
  },
  {
    title: 'Guest Account Isolation',
    code: 'if (req.isGuest) return res.status(403).json({ error: "disabled in demo mode" })',
    desc: 'blockGuests middleware reads isGuest from the JWT (no DB lookup needed) and blocks real-money actions — currently milestone funding. The flag is embedded in the token at sign-time so it\'s fast and tamper-proof.',
    file: 'middleware/blockGuests.js',
  },
];

const PERFORMANCE = [
  {
    title: 'Stateless JWT — No Server Sessions',
    desc: 'Authentication state lives entirely in the signed JWT cookie. Any Express instance can verify it without a shared session store — the only shared state is MongoDB and Redis.',
  },
  {
    title: 'Socket.io Redis Adapter',
    desc: 'The @socket.io/redis-adapter syncs room state across multiple server instances via Upstash Redis pub/sub. The adapter is skipped gracefully when REDIS_URL is not configured (local dev).',
  },
  {
    title: 'Lazy-loaded Route Bundles',
    desc: 'The three showcase pages (Architecture, Engineering, Case Study) and all dashboard pages are loaded via React.lazy() + Suspense. The initial bundle only includes the Landing page and auth flows.',
  },
  {
    title: 'MongoDB Transactions for Escrow',
    desc: 'All 9 state transitions use mongoose.startSession() + session.withTransaction(). Project save, User wallet update, Dispute creation, and AuditLog write all happen atomically — no partial states possible.',
  },
  {
    title: 'Embedded Milestone Subdocuments',
    desc: 'Milestones live inside the Project document (not a separate collection). This means reading a project and all its milestones is a single document fetch — no join or populate needed for the common case.',
  },
  {
    title: 'Fire-and-forget Email Notifications',
    desc: 'Email functions are never awaited in a blocking way. Pattern: emailFn().catch(() => {}) — the HTTP response and state transition are already committed before the email is attempted. Email failures only console.warn.',
  },
];

export default function Engineering() {
  useEffect(() => { document.title = 'Engineering — FlexHire'; }, []);

  return (
    <ShowcaseLayout>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-500">By the Numbers</p>
        <h1 className="mb-4 text-4xl font-extrabold text-gray-900">Engineering Depth</h1>
        <p className="mb-12 max-w-2xl text-lg text-gray-600">
          Every metric is derived by counting real route handlers, socket events, and models in the source code — not estimated.
        </p>

        {/* ── Metrics grid ── */}
        <section className="mb-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((m) => (
              <div key={m.label} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-1 text-4xl font-extrabold text-indigo-600">{m.value}</div>
                <div className="mb-2 font-semibold text-gray-900">{m.label}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{m.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Security ── */}
        <section className="mb-16">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Security Practices</h2>
          <div className="space-y-4">
            {SECURITY.map((s) => (
              <div key={s.title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">{s.file}</span>
                </div>
                <pre className="mb-3 overflow-x-auto rounded-lg bg-gray-900 px-4 py-3 text-xs text-emerald-300">
                  <code>{s.code}</code>
                </pre>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Performance / Scalability ── */}
        <section>
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Performance &amp; Scalability</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {PERFORMANCE.map((p) => (
              <div key={p.title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-2 font-semibold text-gray-900">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ShowcaseLayout>
  );
}
