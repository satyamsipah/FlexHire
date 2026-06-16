import { Link } from 'react-router-dom';
import heroPng from '../assets/hero.png';
import { useGuestLogin } from '../lib/useGuestLogin.js';
import ShowcaseNav from '../components/ShowcaseNav.jsx';

const steps = [
  { icon: '📋', label: 'Post a project', detail: 'Define scope and milestones upfront' },
  { icon: '💰', label: 'Fund a milestone', detail: 'Escrow funds via Razorpay — held until approved' },
  { icon: '🚀', label: 'Freelancer submits', detail: 'Work delivered, client reviews' },
  { icon: '✅', label: 'Approve & auto-payout', detail: 'Funds release instantly to the freelancer' },
];

const features = [
  { icon: '🔒', title: 'Escrow State Machine', body: '9-state milestone lifecycle — CREATED → FUNDED → SUBMITTED → APPROVED — with full audit trail.' },
  { icon: '💬', title: 'Real-time Chat', body: 'Socket.io powered per-project rooms with file attachments via Cloudinary.' },
  { icon: '⚖️', title: 'Dispute Resolution', body: 'Either party can raise a dispute; an admin mediates and resolves with a written resolution.' },
  { icon: '⭐', title: 'Ratings & Reviews', body: 'Mutual reviews unlock after project completion — builds trust on both sides.' },
];

const techBadges = ['React 19', 'Node.js 20', 'MongoDB Atlas', 'Socket.io 4', 'Razorpay'];

const highlights = [
  { label: 'MERN stack', sub: 'MongoDB · Express · React · Node', to: '/case-study' },
  { label: 'JWT auth', sub: 'httpOnly cookies, RBAC middleware', to: '/architecture' },
  { label: 'MongoDB transactions', sub: 'Atomic escrow state transitions', to: '/architecture' },
  { label: 'Socket.io messaging', sub: 'Redis-backed, cookie-authed rooms', to: '/architecture' },
  { label: 'Razorpay escrow', sub: 'Orders, HMAC webhooks, payouts', to: '/engineering' },
  { label: 'Cloudinary uploads', sub: 'multer + CloudinaryStorage', to: '/case-study' },
  { label: 'Audit logs', sub: 'Immutable log on every transition', to: '/engineering' },
  { label: 'Dispute engine', sub: 'Admin-mediated with 2 resolution paths', to: '/architecture' },
];

export default function Landing() {
  const { startGuest, loadingRole } = useGuestLogin();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <ShowcaseNav />

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-indigo-50 to-white px-6 py-20">
        <div className="mx-auto max-w-6xl lg:flex lg:items-center lg:gap-16">
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold leading-tight text-gray-900 sm:text-5xl">
              Freelance work, paid{' '}
              <span className="text-indigo-600">milestone by milestone</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-gray-600">
              Milestone-based escrow for freelance work — clients fund, freelancers deliver,
              funds release on approval. Real-time chat, dispute resolution, and auto-payouts
              built in.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={() => startGuest('client')}
                disabled={loadingRole !== null}
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loadingRole === 'client' ? 'Loading…' : 'Try live demo as Client'}
              </button>
              <button
                onClick={() => startGuest('freelancer')}
                disabled={loadingRole !== null}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                {loadingRole === 'freelancer' ? 'Loading…' : 'Try live demo as Freelancer'}
              </button>
            </div>

            <p className="mt-3 text-xs text-gray-400">No account needed — jumps straight into a live demo.</p>
          </div>

          <div className="mt-12 flex-1 lg:mt-0">
            <img
              src={heroPng}
              alt="FlexHire dashboard preview"
              className="w-full rounded-2xl shadow-xl"
            />
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center">
                <div className="mb-3 text-3xl">{s.icon}</div>
                <div className="mb-1 text-sm font-semibold text-gray-500">Step {i + 1}</div>
                <h3 className="mb-2 font-bold text-gray-900">{s.label}</h3>
                <p className="text-sm text-gray-600">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">Everything you need</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f, i) => (
              <div key={i} className="rounded-xl bg-white p-6 shadow-sm">
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="mb-2 font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Technical Highlights ── */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-3 text-center text-2xl font-bold text-gray-900">Technical Highlights</h2>
          <p className="mb-10 text-center text-sm text-gray-500">
            Click any card to explore the engineering depth behind it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((h) => (
              <Link
                key={h.label}
                to={h.to}
                className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:border-indigo-300 hover:shadow-md"
              >
                <div className="font-semibold text-gray-900 group-hover:text-indigo-600 text-sm">{h.label}</div>
                <div className="mt-1 text-xs text-gray-500">{h.sub}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech badges ── */}
      <section className="bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-6xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-400">Built with</p>
          <div className="flex flex-wrap justify-center gap-3">
            {techBadges.map((b) => (
              <span key={b} className="rounded-full border border-gray-200 bg-white px-4 py-1 text-sm font-medium text-gray-700">
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 text-sm text-gray-500 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} FlexHire</span>
          <div className="flex gap-6">
            <a
              href="https://github.com/satyamsipah/FlexHire"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-600"
            >
              GitHub
            </a>
            <a href="#" className="hover:text-indigo-600">Portfolio</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
