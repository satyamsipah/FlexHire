import { Router } from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { blockGuests } from '../middleware/blockGuests.js';
import { ROLES } from '../constants/roles.js';
import { MilestoneStateMachine } from '../services/escrow/MilestoneStateMachine.js';
import { createOrder } from '../services/payments/razorpay.js';
import { emitToProject } from '../sockets/chatSocket.js';
import {
  emailMilestoneSubmitted,
  emailMilestoneApproved,
  emailMilestoneDisputed,
  emailMilestoneRefunded,
} from '../services/notifications/email.js';

const router = Router();

async function findProjectByMilestone(milestoneId) {
  return Project.findOne({ 'milestones._id': milestoneId });
}

// ─── Add milestone to an existing project (client only) ──────────────────────

router.post('/project/:projectId', requireAuth, requireRole(ROLES.CLIENT), async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (project.clientId.toString() !== req.userId)
    return res.status(403).json({ error: 'You do not own this project' });

  if (!['ACCEPTED', 'IN_PROGRESS'].includes(project.state))
    return res.status(409).json({ error: 'Milestones can only be added to accepted or in-progress projects' });

  const { title, description, amount } = req.body;
  if (!title || !description || amount == null)
    return res.status(400).json({ error: 'title, description, and amount are required' });

  project.milestones.push({ title, description, amount });
  await project.save();
  res.status(201).json({ project });
});

// ─── Fund: create Razorpay order (state stays CREATED until webhook fires) ───

router.post('/:milestoneId/fund', requireAuth, requireRole(ROLES.CLIENT), blockGuests, async (req, res) => {
  const project = await findProjectByMilestone(req.params.milestoneId);
  if (!project) return res.status(404).json({ error: 'Milestone not found' });

  if (project.clientId.toString() !== req.userId)
    return res.status(403).json({ error: 'You do not own this project' });

  const milestone = project.milestones.id(req.params.milestoneId);

  if (milestone.state !== 'CREATED')
    return res.status(409).json({ error: `Milestone is already in state "${milestone.state}"` });

  if (milestone.razorpayOrderId)
    return res.status(409).json({ error: 'A Razorpay order already exists for this milestone' });

  const order = await createOrder(milestone.amount * 100, milestone._id, project._id);
  milestone.razorpayOrderId = order.id;
  await project.save();

  res.json({
    orderId:       order.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    amount:        order.amount,
    currency:      order.currency,
    milestoneId:   milestone._id,
  });
});

// ─── Start (FUNDED → IN_PROGRESS) ────────────────────────────────────────────

router.post('/:milestoneId/start', requireAuth, requireRole(ROLES.FREELANCER), async (req, res) => {
  const project = await findProjectByMilestone(req.params.milestoneId);
  if (!project) return res.status(404).json({ error: 'Milestone not found' });

  if (project.freelancerId?.toString() !== req.userId)
    return res.status(403).json({ error: 'You are not the assigned freelancer' });

  const milestone = await MilestoneStateMachine.start(req.params.milestoneId, req.userId);

  emitToProject(project._id, 'milestone:started', {
    projectId: project._id, milestoneId: req.params.milestoneId, milestone,
  });

  res.json({ milestone });
});

// ─── Submit (IN_PROGRESS → SUBMITTED) ────────────────────────────────────────

router.post('/:milestoneId/submit', requireAuth, requireRole(ROLES.FREELANCER), async (req, res) => {
  const project = await findProjectByMilestone(req.params.milestoneId);
  if (!project) return res.status(404).json({ error: 'Milestone not found' });

  if (project.freelancerId?.toString() !== req.userId)
    return res.status(403).json({ error: 'You are not the assigned freelancer' });

  const { submissionNote } = req.body;
  const milestone = await MilestoneStateMachine.submit(req.params.milestoneId, req.userId, submissionNote);

  emitToProject(project._id, 'milestone:submitted', {
    projectId: project._id, milestoneId: req.params.milestoneId, milestone,
  });

  // Fire-and-forget — email failure must not affect the response
  User.findById(project.clientId).select('email').lean()
    .then(client => emailMilestoneSubmitted({
      clientEmail:    client.email,
      projectTitle:   project.title,
      milestoneTitle: milestone.title,
      amount:         milestone.amount,
      projectId:      project._id,
    }))
    .catch(() => {});

  res.json({ milestone });
});

// ─── Approve (SUBMITTED → APPROVED) ──────────────────────────────────────────

router.post('/:milestoneId/approve', requireAuth, requireRole(ROLES.CLIENT), async (req, res) => {
  const project = await findProjectByMilestone(req.params.milestoneId);
  if (!project) return res.status(404).json({ error: 'Milestone not found' });

  if (project.clientId.toString() !== req.userId)
    return res.status(403).json({ error: 'You do not own this project' });

  const milestone = await MilestoneStateMachine.approve(req.params.milestoneId, req.userId);

  emitToProject(project._id, 'milestone:approved', {
    projectId: project._id, milestoneId: req.params.milestoneId, milestone,
  });

  User.findById(project.freelancerId).select('email').lean()
    .then(freelancer => emailMilestoneApproved({
      freelancerEmail: freelancer.email,
      projectTitle:    project.title,
      milestoneTitle:  milestone.title,
      amount:          milestone.amount,
      projectId:       project._id,
    }))
    .catch(() => {});

  res.json({ milestone });
});

// ─── Dispute (SUBMITTED → DISPUTED) ──────────────────────────────────────────

router.post('/:milestoneId/dispute', requireAuth, requireRole(ROLES.CLIENT, ROLES.FREELANCER), async (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  const project = await findProjectByMilestone(req.params.milestoneId);
  if (!project) return res.status(404).json({ error: 'Milestone not found' });

  const isClient     = project.clientId.toString() === req.userId;
  const isFreelancer = project.freelancerId?.toString() === req.userId;
  if (!isClient && !isFreelancer)
    return res.status(403).json({ error: 'You are not a party to this project' });

  const result = await MilestoneStateMachine.dispute(req.params.milestoneId, req.userId, reason);

  emitToProject(project._id, 'milestone:disputed', {
    projectId: project._id, milestoneId: req.params.milestoneId, milestone: result.milestone,
  });

  // Notify both parties + admin (fire-and-forget)
  Promise.all([
    User.findById(project.clientId).select('email').lean(),
    User.findById(project.freelancerId).select('email').lean(),
    User.findOne({ role: ROLES.ADMIN }).select('email').lean(),
  ]).then(([client, freelancer, admin]) => {
    const milestone = project.milestones.id(req.params.milestoneId);
    emailMilestoneDisputed({
      clientEmail:     client?.email,
      freelancerEmail: freelancer?.email,
      adminEmail:      admin?.email,
      projectTitle:    project.title,
      milestoneTitle:  milestone?.title,
      projectId:       project._id,
    });
  }).catch(() => {});

  res.json(result);
});

// ─── Cancel (CREATED → CANCELLED) ────────────────────────────────────────────

router.post('/:milestoneId/cancel', requireAuth, requireRole(ROLES.CLIENT), async (req, res) => {
  const project = await findProjectByMilestone(req.params.milestoneId);
  if (!project) return res.status(404).json({ error: 'Milestone not found' });

  if (project.clientId.toString() !== req.userId)
    return res.status(403).json({ error: 'You do not own this project' });

  const milestone = await MilestoneStateMachine.cancel(req.params.milestoneId, req.userId);

  emitToProject(project._id, 'milestone:cancelled', {
    projectId: project._id, milestoneId: req.params.milestoneId, milestone,
  });

  res.json({ milestone });
});

// ─── Auto-refund (FUNDED → AUTO_REFUNDED) ────────────────────────────────────

router.post('/:milestoneId/auto-refund', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  const project = await findProjectByMilestone(req.params.milestoneId);
  const milestone = await MilestoneStateMachine.autoRefund(req.params.milestoneId, req.userId);

  if (project) {
    emitToProject(project._id, 'milestone:auto_refunded', {
      projectId: project._id, milestoneId: req.params.milestoneId, milestone,
    });

    User.findById(project.clientId).select('email').lean()
      .then(client => emailMilestoneRefunded({
        clientEmail:    client.email,
        projectTitle:   project.title,
        milestoneTitle: milestone.title,
        amount:         milestone.amount,
        projectId:      project._id,
      }))
      .catch(() => {});
  }

  res.json({ milestone });
});

// ─── Wallet (freelancer balance) ──────────────────────────────────────────────

router.get('/wallet', requireAuth, requireRole(ROLES.FREELANCER), async (req, res) => {
  const user = await User.findById(req.userId).select('walletBalance');
  res.json({ walletBalance: user.walletBalance });
});

// ─── Audit log (admin) ────────────────────────────────────────────────────────

router.get('/audit-logs', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  const logs = await AuditLog
    .find()
    .sort({ timestamp: -1 })
    .limit(100)
    .populate('userId', 'name email');
  res.json({ logs });
});

export default router;
