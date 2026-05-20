# FlexHire

FlexHire is a freelancer marketplace where clients post projects with milestone-based escrow
payments. Each milestone moves through an 8-state state machine (built in Week 6): the client
funds a milestone via Razorpay, the freelancer completes work and submits, the client approves,
and the escrowed funds are automatically paid out. Disputes are handled by an admin. Socket.io
delivers real-time chat and status updates.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express, ESM modules (`"type":"module"`) |
| Database | MongoDB Atlas via Mongoose 8 |
| Auth | JWT in httpOnly cookies + bcrypt |
| Payments | Razorpay (test mode) — escrow in Week 6 |
| Real-time | Socket.io 4 |
| Frontend | React 19 + Vite, Tailwind CSS v4 |
| State | Zustand |
| File uploads | Cloudinary — Week 7 |
| Email | Nodemailer + Gmail — Week 7 |
| Caching + Socket adapter | Upstash Redis — Week 7 |

---

## Data Models

### User
```
name: String (required)
email: String (unique, lowercase)
password: String (bcrypt hash)
role: 'client' | 'freelancer' | 'admin'   ← admin seeded manually in Atlas
walletBalance: Number (default 0)
razorpayContactId: String (null until first payout)
razorpayFundAccountId: String (null until first payout)
timestamps: true
```

### Project
```
clientId: ObjectId → User
freelancerId: ObjectId → User (null until accepted)
title: String
description: String
totalBudget: Number
state: 'POSTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
milestones: [MilestoneSchema]  ← embedded subdoc, NOT a separate collection
timestamps: true
```

### Milestone (subdoc inside Project)
```
title, description: String
amount: Number
state: 'CREATED' | 'FUNDED' | 'IN_PROGRESS' | 'SUBMITTED' |
       'APPROVED' | 'DISPUTED' | 'REFUNDED' | 'AUTO_REFUNDED' | 'CANCELLED'
razorpayOrderId, razorpayPaymentId, razorpayPayoutId: String (null)
submissionNote: String (null)
submittedAt, approvedAt, refundedAt: Date (null)
```

### Message
```
projectId: ObjectId → Project
senderId:  ObjectId → User
content:   String
attachments: [String]  ← Cloudinary URLs, Week 7
timestamps: true
```

### Dispute
```
milestoneId: ObjectId  ← references MilestoneSchema._id (subdoc, not a collection)
raisedBy:   ObjectId → User
reason:     String
resolution: String (null)
resolvedBy: ObjectId → User (null)
resolvedAt: Date (null)
timestamps: true
```

### AuditLog
```
userId:     ObjectId → User
action:     String
entityType: String  ('Project' | 'Milestone' | 'Dispute')
entityId:   ObjectId
metadata:   Mixed (default {})
timestamp:  Date (default Date.now)
```

---

## Project Structure

```
FlexHire/
├── CLAUDE.md              ← you are here
├── backend/
│   ├── .env.example       ← copy to .env and fill in secrets
│   ├── package.json       ("type":"module")
│   ├── scripts/test-razorpay.js
│   └── src/
│       ├── index.js       (Express + Socket.io, port 5001)
│       ├── config/db.js
│       ├── constants/roles.js     ← ROLES, PROJECT_STATES, MILESTONE_STATES
│       ├── middleware/requireAuth.js, requireRole.js
│       ├── models/User.js, Project.js, Message.js, Dispute.js, AuditLog.js
│       ├── routes/auth.js, projects.js, milestones.js, disputes.js, webhooks.js,
│       │         uploads.js, reviews.js
│       ├── sockets/chatSocket.js          ← /chat namespace + emitToProject()
│       └── services/escrow/MilestoneStateMachine.js
│                payments/razorpay.js
│                notifications/email.js    ← Nodemailer triggers
│                uploads/cloudinary.js     ← multer + CloudinaryStorage
└── frontend/
    ├── vite.config.js     (Tailwind v4 plugin + /api proxy → :5001)
    └── src/
        ├── lib/api.js     (axios, withCredentials:true)
        ├── store/authStore.js
        ├── components/ProtectedRoute.jsx
        ├── hooks/useProjectSocket.js     ← Socket.io hook (connect, join, send)
        └── pages/Login, Signup, ClientDashboard, FreelancerDashboard,
                   AdminDashboard, ProjectChat
```

---

## Current State

| Week | Status | What shipped |
|------|--------|-------------|
| 5 | ✅ Done | Backend scaffold, all 6 schemas, JWT auth with RBAC, project routes, React frontend with role-aware routing |
| 6 | ✅ Done | MilestoneStateMachine (9 transitions, MongoDB transactions, AuditLog), Razorpay Orders + HMAC webhook, mocked Payouts, dispute resolution, Fund/Approve/Dispute/Start/Submit buttons in frontend |
| 7 | ✅ Done | Socket.io /chat namespace with JWT cookie auth + Redis adapter, real-time chat with file uploads (Cloudinary), Nodemailer email triggers on every state transition, dispute UI + ratings/reviews |
| 8 | ✅ Done | UI polish (skeletons, toasts, ConfirmModal, formatINR, timeAgo, 404, ErrorBoundary, disconnect banner), README.md, CLAUDE.md update. Deploy to Render + Vercel (see README). **PROJECT COMPLETE.** |

---

## Deployment

See README.md for full instructions. Quick reference:
- Backend → Render: root `backend`, start `node src/index.js`, set all env vars
- Frontend → Vercel: root `frontend`, set `VITE_API_URL` + `VITE_RAZORPAY_KEY_ID`
- After both are live: update `FRONTEND_URL` in Render + Razorpay webhook URL

**Razorpay Payouts are mocked** — `mockPayout()` in
`backend/src/services/payments/razorpay.js` increments `freelancer.walletBalance` and
returns a fake `payout_mock_<timestamp>` ID. Replace with `razorpay.payouts.create()`
when Razorpay X account is available.

## Former Week 8 Entry Point (now complete)

1. Backend on Render: set all env vars from `.env.example`. Build cmd: `npm install`. Start: `npm start`.
2. Frontend on Vercel: set `VITE_API_URL` if needed. Vite build outputs to `dist/`.
3. Update CORS `CLIENT_URL` in Render env to the Vercel deployment URL.
4. Replace `mockPayout()` in `backend/src/services/payments/razorpay.js` with real
   `razorpay.payouts.create()` — requires Razorpay X account + freelancer `razorpayFundAccountId`.
5. Point Razorpay webhook URL to the Render deployment (no more ngrok).
6. Upstash REDIS_URL must use `rediss://` (TLS) — Render supports it natively.

---

## Critical Gotchas

1. **ESM `.js` extension required** — `import { foo } from './bar.js'` — omitting `.js` breaks
   Node.js ESM module resolution, even when importing TypeScript-style files.

2. **Enum constants in `roles.js` only** — never hardcode `'client'`, `'POSTED'`, etc. as
   string literals in routes or middleware. Import from `backend/src/constants/roles.js`.

3. **`requireRole` must follow `requireAuth`** — `requireRole` reads `req.userRole` which
   only exists after `requireAuth` has run. Always chain them:
   `[requireAuth, requireRole(ROLES.CLIENT), handler]`

4. **Webhook before `express.json()`** — Razorpay HMAC signature verification reads the raw
   request body buffer. Once `express.json()` parses it, the buffer is gone. Register the
   webhook route before the `express.json()` middleware line in `index.js`.

5. **Socket.io + httpOnly cookies** — `document.cookie` cannot read httpOnly cookies. Socket.io
   auth in Week 7 must read the cookie from `socket.handshake.headers.cookie` using the
   `cookie` package, not from the client-side JS.

6. **Tailwind v4** — no `tailwind.config.js` or `postcss.config.js`. Everything is wired via
   `@tailwindcss/vite` in `vite.config.js`. CSS entry: `@import "tailwindcss";` only.

7. **Freelancer project filter (Week 6 update)** — currently `{ state: 'POSTED' }`. After Week
   6 adds the state machine, update to:
   `{ $or: [{ state: 'POSTED' }, { freelancerId: req.userId }] }`
   so freelancers can navigate back to their in-progress projects.

8. **Socket.io namespace is `/chat`** — connect with `io('/chat', { withCredentials: true })`.
   The default namespace `/` is unauthenticated; only `/chat` has `socketAuth` middleware.
   `emitToProject(projectId, event, data)` in `sockets/chatSocket.js` is the single function
   route handlers call to push milestone events into a project room.

9. **Email failures are silent** — all `emailXxx()` functions are wrapped in try/catch and log
   `console.warn` on failure. They must NEVER be awaited in a way that could reject the HTTP
   response. Pattern: `Promise.resolve(emailFn(...)).catch(() => {})` or fire `.then(...).catch(() => {})`.

10. **Razorpay Payouts are mocked** — `mockPayout()` in
   `backend/src/services/payments/razorpay.js` increments `freelancer.walletBalance` and
   returns a fake `payout_mock_<timestamp>` ID instead of calling the real Payouts API.
   Replace with `razorpay.payouts.create()` in Week 8 (requires Razorpay X account +
   freelancer `razorpayFundAccountId`).

---

## Dev Setup

```bash
# Backend
cd backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
npm install
npm run dev            # starts on port 5001 with --watch

# Verify Razorpay credentials
node scripts/test-razorpay.js

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # starts on port 5173; /api proxied to :5001
```
