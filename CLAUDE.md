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
│       ├── routes/auth.js, projects.js, milestones.js, disputes.js, webhooks.js
│       └── services/escrow/MilestoneStateMachine.js
│                payments/razorpay.js
└── frontend/
    ├── vite.config.js     (Tailwind v4 plugin + /api proxy → :5001)
    └── src/
        ├── lib/api.js     (axios, withCredentials:true)
        ├── store/authStore.js
        ├── components/ProtectedRoute.jsx
        └── pages/Login, Signup, ClientDashboard, FreelancerDashboard, AdminDashboard
```

---

## Current State

| Week | Status | What shipped |
|------|--------|-------------|
| 5 | ✅ Done | Backend scaffold, all 6 schemas, JWT auth with RBAC, project routes, React frontend with role-aware routing |
| 6 | ✅ Done | MilestoneStateMachine (9 transitions, MongoDB transactions, AuditLog), Razorpay Orders + HMAC webhook, mocked Payouts, dispute resolution, Fund/Approve/Dispute/Start/Submit buttons in frontend |
| 7 | ⬜ Next | Socket.io chat with project-room auth, Cloudinary file uploads, Nodemailer notifications, Upstash Redis as Socket.io adapter |
| 8 | ⬜ | Deployment (Render + Vercel), end-to-end testing |

---

## Week 7 Entry Point

**Start here**: implement Socket.io chat in `backend/src/socket/`.

1. Install `socket.io` (backend) and `socket.io-client` (frontend) — already in package.json.
2. Auth: read the `token` httpOnly cookie in the `io.use()` middleware via
   `socket.handshake.headers.cookie` + the `cookie` package. Verify the JWT and attach
   `socket.userId` + `socket.userRole`.
3. Room pattern: `socket.join(`project:${projectId}`)` — verify the user is the client or
   freelancer of that project before joining.
4. Events: `chat:send` (client→server) → persist to `Message` collection → emit `chat:message`
   (server→room).
5. Upstash Redis adapter: `@socket.io/redis-adapter` with `@upstash/redis` (REST adapter).
   Env vars `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are already in `.env`.

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

8. **Razorpay Payouts are mocked** — `mockPayout()` in
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
