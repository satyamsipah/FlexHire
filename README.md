# FlexHire

A full-stack freelancer marketplace with milestone-based escrow payments, real-time chat, and dispute resolution.

**Live demo:** _Coming soon (deploy to Render + Vercel — see [Deployment](#deployment))_

---

## 👀 Guest login (for recruiters)

No signup required. On the login page, click **Explore as Guest** and pick
**View as Client** or **View as Freelancer** to jump straight into a populated demo —
open job posts, a mid-escrow project, and a chat thread are already seeded.

Demo accounts are blocked from real-money / destructive actions (e.g. funding a
milestone via Razorpay); everything else — posting projects, accepting work,
approving milestones, chat — is fully explorable.

> One-time setup: after configuring the backend, run `npm run seed:guests` (see
> [Local setup](#local-setup)) to create the demo accounts and data.

---

## What it does

Clients post projects with one or more milestones. Each milestone has a fixed price and travels through an 8-state escrow lifecycle: the client funds via Razorpay, the freelancer completes and submits work, the client approves and the funds are released — or a dispute is raised and an admin resolves it. All milestone events are pushed live to both parties via Socket.io.

---

## State machine

```
                ┌─────────┐
          fund  │         │ cancel
  ┌────────────►│ FUNDED  │◄───────────────┐
  │             │         │                │
  │             └────┬────┘                │
  │                  │ start               │
  │             ┌────▼────┐                │
  │             │IN_PROGR.│           ┌────┴────┐
  │             └────┬────┘           │ CREATED │
  │                  │ submit         └─────────┘
  │             ┌────▼────┐
  │             │SUBMITTED│
  │             └──┬──┬───┘
  │        approve │  │ dispute
  │         ┌──────┘  └──────┐
  │    ┌────▼────┐       ┌────▼────┐
  │    │APPROVED │       │DISPUTED │
  │    └─────────┘       └──┬──┬───┘
  │                  approve│  │refund
  │                  ┌──────┘  └──────┐
  │              ┌───▼─────┐   ┌──────▼──┐
  │              │APPROVED │   │REFUNDED │
  │              └─────────┘   └─────────┘
  │
  └──── autoRefund ────► REFUNDED
                              ▲
                    CANCELLED─┘ (from CREATED only)
```

| # | Transition | From | To | Who |
|---|-----------|------|----|-----|
| 1 | fund | CREATED | FUNDED | Razorpay webhook |
| 2 | start | FUNDED | IN_PROGRESS | Freelancer |
| 3 | submit | IN_PROGRESS | SUBMITTED | Freelancer |
| 4 | approve | SUBMITTED | APPROVED | Client |
| 5 | dispute | SUBMITTED | DISPUTED | Client or Freelancer |
| 6 | resolveDispute(approve) | DISPUTED | APPROVED | Admin |
| 7 | resolveDispute(refund) | DISPUTED | REFUNDED | Admin |
| 8 | cancel | CREATED | CANCELLED | Client |
| 9 | autoRefund | FUNDED | REFUNDED | Admin |

When the last milestone reaches APPROVED, the Project atomically transitions to COMPLETED in the same MongoDB transaction.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20 · Express · ESM modules |
| Database | MongoDB Atlas · Mongoose 8 · multi-document transactions |
| Auth | JWT in httpOnly cookies · bcrypt |
| Payments | Razorpay Orders + HMAC webhook · mocked Payouts |
| Real-time | Socket.io 4 · `/chat` namespace · Redis adapter (Upstash) |
| File uploads | Cloudinary · multer-storage-cloudinary |
| Email | Nodemailer · Gmail App Password |
| Frontend | React 19 · Vite · Tailwind CSS v4 |
| State | Zustand |

---

## Architecture highlights

- **Milestone state machine** — `MilestoneStateMachine.js` contains 9 static methods, each wrapped in a `mongoose.startSession()` + `withTransaction()`. Every transition saves an `AuditLog` document in the same transaction. An `InvalidTransitionError` (HTTP 409) is thrown on invalid source states.

- **Webhook-first payment flow** — The `/api/webhooks/razorpay` route is registered *before* `express.json()` so the raw body buffer is intact for HMAC verification. Payment capture fires `MilestoneStateMachine.fund()`.

- **Socket.io auth** — httpOnly cookies can't be read by `document.cookie`. The `socketAuth` middleware parses the raw `Cookie` header from `socket.handshake.headers.cookie` using the `cookie` package, verifies the JWT, and attaches `userId`, `userRole`, and `userName` to the socket.

- **Email fire-and-forget** — All `emailXxx()` calls use `.then(...).catch(() => {})`. A failed SMTP delivery never blocks or rolls back a state transition.

- **Production cookies** — `sameSite: 'none'` + `secure: true` when `NODE_ENV === 'production'` (required for cross-origin Vercel → Render requests).

---

## Local setup

### Prerequisites

- Node.js ≥ 20
- MongoDB Atlas cluster (free tier works)
- Razorpay test account
- Cloudinary account (free tier)
- Gmail App Password (for email notifications)

### Backend

```bash
cd backend
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
#          RAZORPAY_WEBHOOK_SECRET, CLOUDINARY_*, GMAIL_USER, GMAIL_APP_PASSWORD
#          REDIS_URL (optional — Redis adapter is skipped if not set)
npm install
npm run dev        # port 5001
```

### Seed the guest demo accounts

Creates the two demo users (`demo-client@flexhire.demo`, `demo-freelancer@flexhire.demo`)
plus realistic demo data that powers the **Explore as Guest** button. Idempotent — safe
to re-run any time to reset the demo to a clean state:

```bash
cd backend
npm run seed:guests
```

### Frontend

```bash
cd frontend
# .env.local is already gitignored — create it:
echo "VITE_API_URL=http://localhost:5001" > .env.local
echo "VITE_RAZORPAY_KEY_ID=<your_key_id>" >> .env.local
npm install
npm run dev        # port 5173
```

### Webhook (local testing)

```bash
brew install ngrok
ngrok http 5001
# Copy the HTTPS URL → Razorpay Dashboard → Webhooks
# URL: https://<id>.ngrok-free.app/api/webhooks/razorpay
# Events: payment.captured, refund.processed
# Paste the webhook secret into backend/.env as RAZORPAY_WEBHOOK_SECRET
```

### Seed an admin account

Admin accounts cannot be created via the signup API (by design). Seed one directly in Atlas:

```js
// Paste in Atlas Data Explorer → Insert Document in the users collection
{
  "name": "Admin",
  "email": "admin@flexhire.dev",
  "password": "<bcrypt hash of your password>",
  "role": "admin",
  "walletBalance": 0
}
```

Or run in the Node REPL:
```js
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash('yourpassword', 10);
```

---

## Deployment

### Backend → Render

1. Create a new **Web Service** connected to `satyamsipah/FlexHire`.
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `node src/index.js`
5. Environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Long random string |
| `RAZORPAY_KEY_ID` | From Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | From Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | From Razorpay webhook settings |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |
| `GMAIL_USER` | Gmail address |
| `GMAIL_APP_PASSWORD` | 16-char app password |
| `REDIS_URL` | Upstash TLS URL (`rediss://...`) |
| `FRONTEND_URL` | Your Vercel deployment URL |

6. After deploy: update Razorpay webhook URL to `https://<render-url>/api/webhooks/razorpay`.
7. In MongoDB Atlas → Network Access → Add `0.0.0.0/0` (Render uses dynamic IPs).

> **Note:** Render free tier spins down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds. Upgrade to a paid instance for production.

### Frontend → Vercel

1. Import `satyamsipah/FlexHire` in Vercel.
2. Root directory: `frontend`
3. Framework preset: **Vite**
4. Environment variables:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://<your-render-service>.onrender.com` |
| `VITE_RAZORPAY_KEY_ID` | Same as backend `RAZORPAY_KEY_ID` |

5. After Vercel deploy: copy the `*.vercel.app` URL → Render env → `FRONTEND_URL` → redeploy backend.

---

## API overview

```
POST   /api/auth/signup                → create client or freelancer account
POST   /api/auth/login                 → set JWT cookie
POST   /api/auth/logout                → clear cookie
GET    /api/auth/me                    → current user

GET    /api/projects                   → list (role-filtered)
POST   /api/projects                   → client: create project
GET    /api/projects/:id               → get project + milestones
POST   /api/projects/:id/accept        → freelancer: accept project
POST   /api/projects/:projectId/milestones → client: add milestone

POST   /api/milestones/:id/fund        → client: create Razorpay order
POST   /api/milestones/:id/start       → freelancer: begin work
POST   /api/milestones/:id/submit      → freelancer: submit + note
POST   /api/milestones/:id/approve     → client: approve + trigger payout
POST   /api/milestones/:id/dispute     → client or freelancer: raise dispute
POST   /api/milestones/:id/auto-refund → admin: refund without dispute
GET    /api/milestones/audit-logs      → admin: last 100 events

POST   /api/webhooks/razorpay          → Razorpay payment.captured / refund.processed

GET    /api/disputes                   → admin: all disputes (enriched)
POST   /api/disputes/:id/resolve       → admin: approve or refund

POST   /api/uploads                    → authenticated: upload file to Cloudinary
GET    /api/projects/:id/messages      → chat history
POST   /api/reviews/:projectId         → post rating + comment
GET    /api/reviews/:projectId/mine    → check if already reviewed
GET    /api/wallet                     → freelancer: wallet balance

GET    /api/health                     → Render health check
```

---

## Project structure

```
FlexHire/
├── README.md
├── CLAUDE.md          ← AI assistant context + gotchas
├── backend/
│   ├── .env.example
│   ├── package.json   ("type":"module")
│   └── src/
│       ├── index.js   (Express + Socket.io, port 5001)
│       ├── config/    db.js, redis.js
│       ├── constants/ roles.js
│       ├── middleware/ requireAuth.js, requireRole.js, socketAuth.js
│       ├── models/    User, Project, Message, Dispute, AuditLog, Review
│       ├── routes/    auth, projects, milestones, disputes, webhooks, uploads, reviews
│       ├── services/  escrow/MilestoneStateMachine.js
│       │              payments/razorpay.js
│       │              notifications/email.js
│       │              uploads/cloudinary.js
│       └── sockets/   chatSocket.js
└── frontend/
    └── src/
        ├── lib/       api.js, format.js
        ├── store/     authStore.js
        ├── hooks/     useProjectSocket.js
        ├── components/ ProtectedRoute, ErrorBoundary, ConfirmModal
        └── pages/     Login, Signup, ClientDashboard, FreelancerDashboard,
                       AdminDashboard, ProjectChat, NotFound
```
