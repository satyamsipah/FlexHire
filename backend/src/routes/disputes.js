import { Router } from 'express';
import Dispute from '../models/Dispute.js';
import Project from '../models/Project.js';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../constants/roles.js';
import { MilestoneStateMachine } from '../services/escrow/MilestoneStateMachine.js';
import { emitToProject } from '../sockets/chatSocket.js';
import { emailMilestoneApproved, emailMilestoneRefunded } from '../services/notifications/email.js';
import User from '../models/User.js';

const router = Router();

// GET /api/disputes — admin sees all disputes enriched with project + milestone data
router.get('/', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  const disputes = await Dispute
    .find()
    .sort({ createdAt: -1 })
    .populate('raisedBy', 'name email')
    .populate('resolvedBy', 'name email');

  const enriched = await Promise.all(disputes.map(async d => {
    const project = await Project
      .findOne({ 'milestones._id': d.milestoneId })
      .populate('clientId',     'name email')
      .populate('freelancerId', 'name email')
      .lean();

    const milestone = project?.milestones?.find(
      m => m._id.toString() === d.milestoneId.toString()
    );

    return {
      ...d.toObject(),
      project:   project ? { _id: project._id, title: project.title, state: project.state, clientId: project.clientId, freelancerId: project.freelancerId } : null,
      milestone: milestone ? { title: milestone.title, amount: milestone.amount, state: milestone.state, submissionNote: milestone.submissionNote } : null,
    };
  }));

  res.json({ disputes: enriched });
});

// POST /api/disputes/:disputeId/resolve — admin resolves a dispute
// Body: { resolution: 'approve' | 'refund', adminNote }
router.post('/:disputeId/resolve', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  const dispute = await Dispute.findById(req.params.disputeId);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

  if (dispute.resolvedAt)
    return res.status(409).json({ error: 'Dispute is already resolved' });

  const { resolution } = req.body;
  if (!resolution) return res.status(400).json({ error: 'resolution is required' });

  const milestone = await MilestoneStateMachine.resolveDispute(
    dispute.milestoneId,
    dispute._id,
    resolution,
    req.userId
  );

  // Emit to project room
  const projectId = dispute.projectId;
  if (projectId) {
    emitToProject(projectId, `milestone:${resolution === 'approve' ? 'approved' : 'refunded'}`, {
      projectId, milestoneId: dispute.milestoneId, milestone,
    });

    // Fire-and-forget emails
    const project = await Project
      .findById(projectId)
      .populate('clientId',     'email')
      .populate('freelancerId', 'email')
      .lean();

    if (project) {
      const mTitle  = milestone.title;
      const mAmount = milestone.amount;

      if (resolution === 'approve') {
        emailMilestoneApproved({
          freelancerEmail: project.freelancerId?.email,
          projectTitle:    project.title,
          milestoneTitle:  mTitle,
          amount:          mAmount,
          projectId,
        }).catch(() => {});
      } else {
        emailMilestoneRefunded({
          clientEmail:    project.clientId?.email,
          projectTitle:   project.title,
          milestoneTitle: mTitle,
          amount:         mAmount,
          projectId,
        }).catch(() => {});
      }
    }
  }

  res.json({ milestone, dispute: { ...dispute.toObject(), resolution, resolvedBy: req.userId } });
});

export default router;
