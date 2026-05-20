import { Router } from 'express';
import Dispute from '../models/Dispute.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../constants/roles.js';
import { MilestoneStateMachine } from '../services/escrow/MilestoneStateMachine.js';

const router = Router();

// GET /api/disputes — admin sees all open disputes
router.get('/', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  const disputes = await Dispute
    .find()
    .sort({ createdAt: -1 })
    .populate('raisedBy', 'name email')
    .populate('resolvedBy', 'name email');
  res.json({ disputes });
});

// POST /api/disputes/:disputeId/resolve — admin resolves a dispute
// Body: { resolution: 'approve' | 'refund', reason }
router.post('/:disputeId/resolve', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  const dispute = await Dispute.findById(req.params.disputeId);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

  if (dispute.resolvedAt)
    return res.status(409).json({ error: 'Dispute is already resolved' });

  const { resolution, reason } = req.body;
  if (!resolution) return res.status(400).json({ error: 'resolution is required' });

  const milestone = await MilestoneStateMachine.resolveDispute(
    dispute.milestoneId,
    dispute._id,
    resolution,
    req.userId
  );

  res.json({ milestone, dispute: { ...dispute.toObject(), resolution, resolvedBy: req.userId } });
});

export default router;
