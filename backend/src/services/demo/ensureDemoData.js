import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { DEMO_USERS } from '../../constants/guests.js';
import { ROLES } from '../../constants/roles.js';
import User from '../../models/User.js';
import Project from '../../models/Project.js';
import Message from '../../models/Message.js';
import Dispute from '../../models/Dispute.js';

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

const seedPaymentId = () => `pay_seed_${crypto.randomBytes(6).toString('hex')}`;
const daysAgo       = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export async function ensureDemoData({ reset = false } = {}) {
  const client     = await upsertDemoUser(DEMO_USERS[ROLES.CLIENT]);
  const freelancer = await upsertDemoUser(DEMO_USERS[ROLES.FREELANCER]);

  if (reset) {
    const oldProjects   = await Project.find({ clientId: client._id }).select('_id');
    const oldProjectIds = oldProjects.map((p) => p._id);
    await Message.deleteMany({ projectId: { $in: oldProjectIds } });
    await Dispute.deleteMany({ projectId: { $in: oldProjectIds } });
    await Project.deleteMany({ clientId: client._id });
  } else {
    const count = await Project.countDocuments({ clientId: client._id });
    if (count > 0) return;
  }

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

  const approvedTotal = escrow.milestones
    .filter((m) => m.state === 'APPROVED')
    .reduce((sum, m) => sum + m.amount, 0);
  await User.findByIdAndUpdate(freelancer._id, { walletBalance: approvedTotal });

  await Message.create([
    { projectId: escrow._id, senderId: client._id,     content: 'Hey! Excited to kick this off. The Figma is in the shared folder.', createdAt: daysAgo(10) },
    { projectId: escrow._id, senderId: freelancer._id, content: 'Got it — starting on the design system today. Should have the first milestone up in a couple of days.', createdAt: daysAgo(10) },
    { projectId: escrow._id, senderId: freelancer._id, content: 'Design system & navigation submitted ✅', createdAt: daysAgo(9) },
    { projectId: escrow._id, senderId: client._id,     content: 'Looks great, approved! Go ahead with the catalog & cart.', createdAt: daysAgo(8) },
    { projectId: escrow._id, senderId: freelancer._id, content: 'Catalog & cart are in review now. One question on the checkout edge cases — left a note on the milestone.', createdAt: daysAgo(1) },
  ]);
}
