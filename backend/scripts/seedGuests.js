// Seeds the two demo accounts + realistic demo data for the one-click
// "Explore as Guest" flow. Run from the backend/ directory:
//   npm run seed:guests
//
// Idempotent: re-running upserts the demo users and fully replaces their demo
// projects/messages/disputes — never duplicating, never touching real users'
// data (every delete is scoped to the demo client's own _id).
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { connectDB } from '../src/config/db.js';
import { DEMO_USERS } from '../src/constants/guests.js';
import { ROLES } from '../src/constants/roles.js';
import User from '../src/models/User.js';
import Project from '../src/models/Project.js';
import Message from '../src/models/Message.js';
import Dispute from '../src/models/Dispute.js';

// Upsert a demo user by email. Password is a throwaway random hash — guests
// authenticate via POST /api/auth/guest (no password), so no one can /login as
// these accounts. Set on insert only, so re-runs don't churn it.
async function upsertDemoUser(demo) {
  const randomHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 12);
  return User.findOneAndUpdate(
    { email: demo.email },
    {
      $set:         { name: demo.name, role: demo.role, isGuest: true },
      $setOnInsert: { password: randomHash },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// A funded milestone always carries a payment id (it reached FUNDED via the
// Razorpay webhook). We fake those ids — no real Razorpay call is ever made.
const seedPaymentId = () => `pay_seed_${crypto.randomBytes(6).toString('hex')}`;
const daysAgo       = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function run() {
  await connectDB();

  const client     = await upsertDemoUser(DEMO_USERS[ROLES.CLIENT]);
  const freelancer = await upsertDemoUser(DEMO_USERS[ROLES.FREELANCER]);

  // ── Scoped reset: wipe ONLY this demo client's projects + their messages/disputes ──
  const oldProjects   = await Project.find({ clientId: client._id }).select('_id');
  const oldProjectIds = oldProjects.map((p) => p._id);
  await Message.deleteMany({ projectId: { $in: oldProjectIds } });
  await Dispute.deleteMany({ projectId: { $in: oldProjectIds } });
  await Project.deleteMany({ clientId: client._id });

  // ── 3 open job posts (POSTED) — visible in the freelancer marketplace ──
  await Project.create([
    {
      clientId:    client._id,
      title:       'Landing page for a SaaS product',
      description: 'Need a responsive marketing site (hero, pricing, FAQ) built with React + Tailwind. Figma provided.',
      totalBudget: 30000,
      state:       'POSTED',
      milestones: [
        { title: 'Hero + pricing sections', description: 'Pixel-perfect from Figma, fully responsive.', amount: 18000 },
        { title: 'FAQ + footer + polish',   description: 'Remaining sections and final QA pass.',         amount: 12000 },
      ],
    },
    {
      clientId:    client._id,
      title:       'REST API for an inventory app',
      description: 'Node/Express + MongoDB CRUD API with JWT auth and pagination. ~10 endpoints.',
      totalBudget: 45000,
      state:       'POSTED',
      milestones: [
        { title: 'Auth + data models', description: 'JWT auth, user/product schemas, seed data.', amount: 20000 },
        { title: 'CRUD endpoints',     description: 'Products & orders endpoints with validation.', amount: 25000 },
      ],
    },
    {
      clientId:    client._id,
      title:       'Logo + brand kit for a coffee startup',
      description: 'Primary logo, color palette, and a one-page brand guideline. Cozy, modern feel.',
      totalBudget: 15000,
      state:       'POSTED',
      milestones: [
        { title: 'Logo concepts', description: '3 directions to choose from.', amount: 15000 },
      ],
    },
  ]);

  // ── 1 mid-escrow project (IN_PROGRESS) assigned to the demo freelancer ──
  // Milestones span states so BOTH demo roles have something to do:
  //   APPROVED    → already paid (freelancer wallet credited below)
  //   SUBMITTED   → demo client can Approve / Dispute; demo freelancer can Dispute
  //   IN_PROGRESS → demo freelancer can Submit
  const escrow = await Project.create({
    clientId:     client._id,
    freelancerId: freelancer._id,
    title:        'E-commerce mobile app (React Native)',
    description:  'Cross-platform shopping app: catalog, cart, checkout, and order tracking. Delivered in milestones.',
    totalBudget:  60000,
    state:        'IN_PROGRESS',
    milestones: [
      {
        title:             'Design system & navigation',
        description:       'Theme, reusable components, and tab/stack navigation.',
        amount:            15000,
        state:             'APPROVED',
        razorpayPaymentId: seedPaymentId(),
        razorpayPayoutId:  `payout_mock_seed_${Date.now()}`,
        submissionNote:    'Component library + navigation shipped. Storybook attached in chat.',
        submittedAt:       daysAgo(9),
        approvedAt:        daysAgo(8),
      },
      {
        title:             'Catalog & cart',
        description:       'Product list, detail screen, and cart with persistence.',
        amount:            25000,
        state:             'SUBMITTED',
        razorpayPaymentId: seedPaymentId(),
        submissionNote:    'Catalog + cart done. Please review the checkout edge cases noted in chat.',
        submittedAt:       daysAgo(1),
      },
      {
        title:             'Checkout & order tracking',
        description:       'Payment flow, order confirmation, and live status updates.',
        amount:            20000,
        state:             'IN_PROGRESS',
        razorpayPaymentId: seedPaymentId(),
      },
    ],
  });

  // The APPROVED milestone was already paid out — reflect it in the wallet.
  // Set (not increment) so re-runs stay deterministic.
  const approvedTotal = escrow.milestones
    .filter((m) => m.state === 'APPROVED')
    .reduce((sum, m) => sum + m.amount, 0);
  await User.findByIdAndUpdate(freelancer._id, { walletBalance: approvedTotal });

  // ── A few chat messages between the two demo users on the escrow project ──
  await Message.create([
    { projectId: escrow._id, senderId: client._id,     content: 'Hey! Excited to kick this off. The Figma is in the shared folder.', createdAt: daysAgo(10) },
    { projectId: escrow._id, senderId: freelancer._id, content: 'Got it — starting on the design system today. Should have the first milestone up in a couple of days.', createdAt: daysAgo(10) },
    { projectId: escrow._id, senderId: freelancer._id, content: 'Design system & navigation submitted ✅', createdAt: daysAgo(9) },
    { projectId: escrow._id, senderId: client._id,     content: 'Looks great, approved! Go ahead with the catalog & cart.', createdAt: daysAgo(8) },
    { projectId: escrow._id, senderId: freelancer._id, content: 'Catalog & cart are in review now. One question on the checkout edge cases — left a note on the milestone.', createdAt: daysAgo(1) },
  ]);

  console.log('\n✅ Guest demo data seeded:');
  console.table([
    { role: client.role,     email: client.email,     id: client._id.toString() },
    { role: freelancer.role, email: freelancer.email, id: freelancer._id.toString() },
  ]);
  console.log(`   Open job posts: 3 (POSTED)`);
  console.log(`   Mid-escrow project: "${escrow.title}" (${escrow._id})`);
  console.log(`   Freelancer wallet balance: ₹${approvedTotal}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
