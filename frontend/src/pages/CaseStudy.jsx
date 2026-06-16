import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import ShowcaseLayout from '../components/ShowcaseLayout.jsx';

const STACK = [
  { layer: 'Frontend',        tech: 'React 19 + Vite 8',          note: 'Zustand, react-router-dom v7, Tailwind CSS v4' },
  { layer: 'Backend',         tech: 'Node.js 20, Express',         note: 'ESM modules ("type":"module"), cookie-parser, express-rate-limit' },
  { layer: 'Database',        tech: 'MongoDB Atlas',               note: 'Mongoose 8, replica set, multi-document transactions' },
  { layer: 'Auth',            tech: 'JWT + bcrypt',                note: 'httpOnly cookie, 12-round hash, 7-day expiry' },
  { layer: 'Payments',        tech: 'Razorpay',                    note: 'Orders API, HMAC webhook, Payouts (mocked — see roadmap)' },
  { layer: 'Real-time',       tech: 'Socket.io 4',                 note: '/chat namespace, Redis adapter via @socket.io/redis-adapter' },
  { layer: 'File uploads',    tech: 'Cloudinary',                  note: 'multer + CloudinaryStorage, stored as URL array on Message' },
  { layer: 'Email',           tech: 'Nodemailer + Gmail',          note: 'Fire-and-forget — failures never block HTTP responses' },
  { layer: 'Caching / Scale', tech: 'Upstash Redis',              note: 'TLS (rediss://), Socket.io pub/sub adapter' },
  { layer: 'Deploy',          tech: 'Render + Vercel',             note: 'Backend on Render (Node), frontend on Vercel (static)' },
];

const CHALLENGES = [
  {
    num: '01',
    title: 'Atomic escrow state transitions',
    problem: 'A milestone approval involves three writes: updating the milestone state, crediting the freelancer\'s wallet, and writing an AuditLog entry. If any of them fail mid-flight, the funds could be double-counted or lost.',
    solution: 'Wrapped every state transition in a Mongoose session (session.withTransaction). All three writes happen in a single MongoDB multi-document transaction — either all commit or all roll back.',
    code: 'await session.withTransaction(async () => {\n  milestone.state = "APPROVED";\n  await project.save({ session });\n  await User.findByIdAndUpdate(freelancerId,\n    { $inc: { walletBalance: amount } }, { session });\n  await AuditLog.create([{ action: "MILESTONE_APPROVED", ... }], { session });\n});',
    file: 'services/escrow/MilestoneStateMachine.js',
  },
  {
    num: '02',
    title: 'Socket.io auth with httpOnly cookies',
    problem: 'httpOnly cookies are invisible to JavaScript — document.cookie returns nothing. The standard Socket.io auth pattern (passing a token in auth.token from the client) cannot be used.',
    solution: 'The /chat namespace uses a custom socketAuth middleware that reads socket.handshake.headers.cookie, parses it with the cookie package server-side, and verifies the JWT — exactly like requireAuth does for HTTP requests.',
    code: 'chatNs.use(socketAuth); // runs before every connection\n\n// in socketAuth.js:\nconst cookies = cookie.parse(socket.handshake.headers.cookie || "");\nconst decoded = jwt.verify(cookies.token, process.env.JWT_SECRET);\nsocket.userId   = decoded.userId;\nsocket.userRole = decoded.role;',
    file: 'sockets/chatSocket.js · middleware/socketAuth.js',
  },
  {
    num: '03',
    title: 'Razorpay webhook body integrity',
    problem: 'Razorpay signs webhooks with an HMAC-SHA256 signature computed over the raw request body. Once Express\'s JSON parser runs, the body is converted to a JS object — the original Buffer is gone and the signature can no longer be verified.',
    solution: 'The webhook route is registered before express.json() in index.js. It uses express.raw({ type: "application/json" }) internally to capture the raw buffer, compute the HMAC, and only proceed if the signature matches.',
    code: '// index.js — ORDER MATTERS:\napp.use("/api/webhooks", webhookRoutes); // raw body, HMAC check\napp.use(express.json());                  // JSON for everything else',
    file: 'index.js · routes/webhooks.js',
  },
  {
    num: '04',
    title: 'Role-based access control middleware chain',
    problem: 'requireRole needs to know the user\'s role to gate access. If it reads from the DB on every request, it adds a round-trip to every protected endpoint. If it reads from req.userRole, that field must exist before requireRole runs.',
    solution: 'requireAuth always runs first: it verifies the JWT and attaches req.userId and req.userRole. requireRole then reads req.userRole without touching the DB. Role constants are imported from constants/roles.js — never hardcoded strings.',
    code: '// Correct chain — requireAuth MUST precede requireRole\nrouter.post("/fund", [\n  requireAuth,\n  requireRole(ROLES.CLIENT),\n  blockGuests,\n  handler\n]);',
    file: 'middleware/requireAuth.js · middleware/requireRole.js',
  },
];

const ROADMAP = [
  {
    item: 'Real Razorpay Payouts',
    why: 'Currently mocked via mockPayout() — increments walletBalance in MongoDB and returns a fake ID. Replace with razorpay.payouts.create() when a Razorpay X account and freelancer razorpayFundAccountId are available.',
    label: 'future',
  },
  {
    item: 'Proposals system',
    why: 'Freelancers currently accept a project directly. A real marketplace needs a Proposal model: freelancer bids with a pitch and price, client reviews proposals and awards the project.',
    label: 'future',
  },
  {
    item: 'Freelancer profiles',
    why: 'Skills, hourly rate, portfolio, and availability fields don\'t exist in the current User schema. Adding them correctly requires schema changes + search/filter endpoints — not a frontend-only mock.',
    label: 'future',
  },
  {
    item: 'Auto-refund cron job',
    why: 'The FUNDED → AUTO_REFUNDED transition is already in the state machine but is triggered manually by admins. A cron job (e.g. via Upstash QStash) should fire it automatically after 30 days of inactivity.',
    label: 'future',
  },
];

export default function CaseStudy() {
  useEffect(() => { document.title = 'Case Study — FlexHire'; }, []);

  return (
    <ShowcaseLayout>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-500">Project Narrative</p>
        <h1 className="mb-4 text-4xl font-extrabold text-gray-900">Case Study</h1>
        <p className="mb-12 max-w-2xl text-lg text-gray-600">
          How FlexHire was designed, what engineering problems it solved, and what comes next.
        </p>

        {/* ── Problem ── */}
        <section className="mb-14">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">The Problem</h2>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
            <p className="text-gray-700 leading-relaxed mb-3">
              Freelance marketplaces traditionally suffer from a trust gap: clients pay upfront and hope the work is delivered, or freelancers deliver first and hope they get paid. Neither party has a guarantee.
            </p>
            <p className="text-gray-700 leading-relaxed">
              The goal with FlexHire was to build a <strong>milestone-based escrow system</strong> where funds are held by the platform until work is approved — clients can't withhold pay, and freelancers can't disappear with the money. Add real-time communication and a dispute resolution path, and both parties have recourse.
            </p>
          </div>
        </section>

        {/* ── Solution ── */}
        <section className="mb-14">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">The Solution</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: '🔒', title: 'Escrow state machine', body: 'A 9-state, 9-transition state machine with MongoDB transactions guarantees that funds, state, and audit records are always consistent.' },
              { icon: '💬', title: 'Real-time workspace', body: 'Socket.io /chat namespace with per-project rooms. Both parties communicate and see milestone updates without polling.' },
              { icon: '⚖️', title: 'Admin dispute path', body: 'Either party can raise a dispute on a SUBMITTED milestone. An admin reviews and either approves (payout) or refunds (Razorpay refund) atomically.' },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-3 text-3xl">{c.icon}</div>
                <h3 className="mb-2 font-semibold text-gray-900">{c.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Technical Challenges ── */}
        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Technical Challenges</h2>
          <div className="space-y-6">
            {CHALLENGES.map((c) => (
              <div key={c.num} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-start gap-4 p-6 pb-4">
                  <span className="text-3xl font-extrabold text-gray-200 leading-none">{c.num}</span>
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{c.title}</h3>
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-600">{c.file}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-rose-600">Problem: </span>
                      <span className="text-sm text-gray-600">{c.problem}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Solution: </span>
                      <span className="text-sm text-gray-600">{c.solution}</span>
                    </div>
                  </div>
                </div>
                <pre className="overflow-x-auto bg-gray-900 px-6 py-4 text-xs text-emerald-300 leading-relaxed">
                  <code>{c.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tech Stack ── */}
        <section className="mb-14">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Tech Stack</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Layer</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Technology</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody>
                {STACK.map((s, i) => (
                  <tr key={s.layer} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.layer}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-700 whitespace-nowrap">{s.tech}</td>
                    <td className="px-4 py-3 text-gray-600">{s.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Roadmap ── */}
        <section className="mb-8">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Roadmap</h2>
          <p className="mb-6 text-sm text-gray-500">
            These are honest next steps — not built yet. Everything above this line is real and live in the demo.
          </p>
          <div className="space-y-3">
            {ROADMAP.map((r) => (
              <div key={r.item} className="flex items-start gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <span className="mt-0.5 rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold uppercase text-gray-600 whitespace-nowrap">
                  {r.label}
                </span>
                <div>
                  <div className="font-medium text-gray-900">{r.item}</div>
                  <div className="mt-1 text-sm text-gray-600">{r.why}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            to="/architecture"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            View Architecture →
          </Link>
          <Link
            to="/engineering"
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Engineering Depth →
          </Link>
        </div>
      </div>
    </ShowcaseLayout>
  );
}
