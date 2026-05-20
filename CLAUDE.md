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
       'APPROVED' | 'DISPUTED' | 'REFUNDED' | 'CANCELLED'
       ← Add 'AUTO_REFUNDED' in Week 6 (Razorpay webhook terminal state)
razorpayOrderId, razorpayPaymentId, razorpayPayoutId: String (null)
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
│       └── routes/auth.js, projects.js
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
| 6 | ⬜ Next | MilestoneStateMachine, Razorpay escrow (create order → fund → payout), webhook, `PATCH /api/projects/:id/milestones/:mId/transition` |
| 7 | ⬜ | Socket.io chat, Cloudinary uploads, Nodemailer, Upstash Redis |
| 8 | ⬜ | Deployment (Render + Vercel), end-to-end testing |

---

## Week 6 Entry Point

**Start here**: implement `EscrowStateMachine` in
`backend/src/services/escrow/EscrowStateMachine.js`.

The state machine has 8 states and 12 transitions (see spec). Integration points:
1. `POST /api/projects/:id/milestones/:mId/fund` — create Razorpay order, transition CREATED→FUNDED
2. `POST /api/projects/:id/milestones/:mId/submit` — freelancer submits, FUNDED/IN_PROGRESS→SUBMITTED
3. `POST /api/projects/:id/milestones/:mId/approve` — client approves, triggers Razorpay payout, SUBMITTED→APPROVED
4. `POST /api/webhooks/razorpay` — handle `payment.captured` and `order.paid` events
5. Remember: webhook route must be registered **before** `express.json()` in index.js

Also needed: Razorpay Fund Account API setup for freelancer payouts (needs razorpayContactId +
razorpayFundAccountId on the User model — fields already exist, just unpopulated).

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

8. **`MILESTONE_STATES` needs `'AUTO_REFUNDED'`** — add it at the start of Week 6. It is the
   terminal state written by the Razorpay webhook when a funded order expires.

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
