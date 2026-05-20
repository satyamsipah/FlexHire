import mongoose from 'mongoose';
import Project from '../../models/Project.js';
import AuditLog from '../../models/AuditLog.js';
import Dispute from '../../models/Dispute.js';
import User from '../../models/User.js';
import { mockPayout, refundPayment } from '../payments/razorpay.js';

// Thrown when a transition is attempted from the wrong source state.
// Routes catch this and respond with HTTP 409.
export class InvalidTransitionError extends Error {
  constructor(currentState, action) {
    super(`Cannot perform "${action}" on a milestone in state "${currentState}"`);
    this.name   = 'InvalidTransitionError';
    this.status = 409;
  }
}

// ─── private helpers ─────────────────────────────────────────────────────────

// Find the project that contains this milestone and validate its current state.
async function load(milestoneId, expectedState, action, session) {
  const project = await Project
    .findOne({ 'milestones._id': milestoneId })
    .session(session);

  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });

  const milestone = project.milestones.id(milestoneId);
  if (!milestone)  throw Object.assign(new Error('Milestone not found'), { status: 404 });

  if (milestone.state !== expectedState)
    throw new InvalidTransitionError(milestone.state, action);

  return { project, milestone };
}

// Write an immutable audit entry inside an ongoing transaction.
async function audit(session, userId, action, milestoneId, metadata = {}) {
  await AuditLog.create(
    [{ userId, action, entityType: 'Milestone', entityId: milestoneId, metadata }],
    { session }
  );
}

// Wraps fn in a Mongoose transaction session. Returns whatever fn returns.
async function withTx(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    await session.endSession();
  }
}

// ─── state machine ───────────────────────────────────────────────────────────

export class MilestoneStateMachine {

  // CREATED → FUNDED
  // Triggered by Razorpay webhook after payment.captured event.
  static async fund(milestoneId, razorpayPaymentId) {
    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'CREATED', 'fund', session);

      milestone.state            = 'FUNDED';
      milestone.razorpayPaymentId = razorpayPaymentId;

      await project.save({ session });
      await audit(session, null, 'MILESTONE_FUNDED', milestoneId, {
        fromState: 'CREATED', toState: 'FUNDED', razorpayPaymentId,
      });

      return milestone;
    });
  }

  // FUNDED → IN_PROGRESS
  // Freelancer manually clicks "Start Work" to acknowledge they are beginning.
  static async start(milestoneId, freelancerId) {
    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'FUNDED', 'start', session);

      milestone.state = 'IN_PROGRESS';

      await project.save({ session });
      await audit(session, freelancerId, 'MILESTONE_STARTED', milestoneId, {
        fromState: 'FUNDED', toState: 'IN_PROGRESS',
      });

      return milestone;
    });
  }

  // IN_PROGRESS → SUBMITTED
  // Freelancer submits work with an optional note for the client to review.
  static async submit(milestoneId, freelancerId, submissionNote) {
    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'IN_PROGRESS', 'submit', session);

      milestone.state          = 'SUBMITTED';
      milestone.submissionNote = submissionNote ?? null;
      milestone.submittedAt    = new Date();

      await project.save({ session });
      await audit(session, freelancerId, 'MILESTONE_SUBMITTED', milestoneId, {
        fromState: 'IN_PROGRESS', toState: 'SUBMITTED', submissionNote,
      });

      return milestone;
    });
  }

  // SUBMITTED → APPROVED
  // Client approves the submission. Mock payout credits the freelancer's wallet.
  // If this is the last milestone, the parent project moves to COMPLETED.
  static async approve(milestoneId, clientId) {
    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'SUBMITTED', 'approve', session);

      // Mock payout — real Razorpay Payouts wired in Week 8
      const payoutId = await mockPayout(project.freelancerId, milestone.amount * 100, milestoneId);

      milestone.state            = 'APPROVED';
      milestone.razorpayPayoutId = payoutId;
      milestone.approvedAt       = new Date();

      // Credit the freelancer's wallet atomically in the same transaction
      await User.findByIdAndUpdate(
        project.freelancerId,
        { $inc: { walletBalance: milestone.amount } },
        { session }
      );

      // Auto-complete project when every milestone is approved
      if (project.milestones.every(m => m.state === 'APPROVED')) {
        project.state = 'COMPLETED';
      }

      await project.save({ session });
      await audit(session, clientId, 'MILESTONE_APPROVED', milestoneId, {
        fromState: 'SUBMITTED', toState: 'APPROVED',
        payoutId, payoutMocked: true,
        projectCompleted: project.state === 'COMPLETED',
      });

      return milestone;
    });
  }

  // SUBMITTED → DISPUTED
  // Either client or freelancer can open a dispute on a submitted milestone.
  // Creates a Dispute document atomically with the state change.
  static async dispute(milestoneId, raisedBy, reason) {
    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'SUBMITTED', 'dispute', session);

      milestone.state = 'DISPUTED';

      const [disputeDoc] = await Dispute.create(
        [{ milestoneId, projectId: project._id, raisedBy, reason }],
        { session }
      );

      await project.save({ session });
      await audit(session, raisedBy, 'MILESTONE_DISPUTED', milestoneId, {
        fromState: 'SUBMITTED', toState: 'DISPUTED',
        disputeId: disputeDoc._id, reason,
      });

      return { milestone, dispute: disputeDoc };
    });
  }

  // DISPUTED → APPROVED  (resolution === 'approve')
  // DISPUTED → REFUNDED  (resolution === 'refund')
  // Admin resolves the dispute. 'approve' triggers the same mock payout as direct approval.
  // 'refund' issues a real Razorpay refund.
  static async resolveDispute(milestoneId, disputeId, resolution, adminId) {
    if (resolution !== 'approve' && resolution !== 'refund')
      throw Object.assign(
        new Error('resolution must be "approve" or "refund"'), { status: 400 }
      );

    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'DISPUTED', 'resolveDispute', session);

      // Update the Dispute document
      await Dispute.findByIdAndUpdate(
        disputeId,
        { resolution, resolvedBy: adminId, resolvedAt: new Date() },
        { session }
      );

      if (resolution === 'approve') {
        const payoutId = await mockPayout(project.freelancerId, milestone.amount * 100, milestoneId);

        milestone.state            = 'APPROVED';
        milestone.razorpayPayoutId = payoutId;
        milestone.approvedAt       = new Date();

        await User.findByIdAndUpdate(
          project.freelancerId,
          { $inc: { walletBalance: milestone.amount } },
          { session }
        );

        if (project.milestones.every(m => m.state === 'APPROVED')) {
          project.state = 'COMPLETED';
        }

        await project.save({ session });
        await audit(session, adminId, 'DISPUTE_RESOLVED', milestoneId, {
          fromState: 'DISPUTED', toState: 'APPROVED', resolution,
          payoutId, payoutMocked: true, disputeId,
        });

        return milestone;
      }

      // resolution === 'refund'
      await refundPayment(milestone.razorpayPaymentId, milestone.amount * 100);

      milestone.state      = 'REFUNDED';
      milestone.refundedAt = new Date();

      await project.save({ session });
      await audit(session, adminId, 'DISPUTE_RESOLVED', milestoneId, {
        fromState: 'DISPUTED', toState: 'REFUNDED', resolution,
        razorpayPaymentId: milestone.razorpayPaymentId, disputeId,
      });

      return milestone;
    });
  }

  // CREATED → CANCELLED
  // Client cancels a milestone before any payment has been initiated.
  static async cancel(milestoneId, clientId) {
    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'CREATED', 'cancel', session);

      milestone.state = 'CANCELLED';

      await project.save({ session });
      await audit(session, clientId, 'MILESTONE_CANCELLED', milestoneId, {
        fromState: 'CREATED', toState: 'CANCELLED',
      });

      return milestone;
    });
  }

  // FUNDED → REFUNDED (AUTO_REFUNDED state)
  // Admin manually triggers a refund on a milestone stuck in FUNDED state
  // (e.g. freelancer went dark, 30-day timeout). Cron automation is Week 7+.
  static async autoRefund(milestoneId, adminId) {
    return withTx(async (session) => {
      const { project, milestone } = await load(milestoneId, 'FUNDED', 'autoRefund', session);

      await refundPayment(milestone.razorpayPaymentId, milestone.amount * 100);

      milestone.state      = 'AUTO_REFUNDED';
      milestone.refundedAt = new Date();

      await project.save({ session });
      await audit(session, adminId, 'MILESTONE_AUTO_REFUNDED', milestoneId, {
        fromState: 'FUNDED', toState: 'AUTO_REFUNDED',
        razorpayPaymentId: milestone.razorpayPaymentId,
      });

      return milestone;
    });
  }
}
