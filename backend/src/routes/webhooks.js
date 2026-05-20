import { Router } from 'express';
import crypto from 'crypto';
import express from 'express';
import Project from '../models/Project.js';
import { MilestoneStateMachine } from '../services/escrow/MilestoneStateMachine.js';

const router = Router();

// POST /api/webhooks/razorpay
// Uses express.raw() so we receive the raw body buffer needed for HMAC verification.
// NEVER move this route after express.json() in index.js — the raw body will be lost.
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // In local dev without a configured secret, skip verification but warn loudly.
    if (secret) {
      const sig      = req.headers['x-razorpay-signature'];
      const computed = crypto
        .createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');

      if (computed !== sig) {
        console.warn('[webhook] Invalid Razorpay signature — request rejected');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } else {
      console.warn('[webhook] RAZORPAY_WEBHOOK_SECRET not set — skipping signature check (dev only)');
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    console.log('[webhook] event:', payload.event);

    try {
      if (payload.event === 'payment.captured') {
        const { id: razorpayPaymentId, order_id: razorpayOrderId } =
          payload.payload.payment.entity;

        // Find the project whose milestone has this order ID
        const project = await Project.findOne({ 'milestones.razorpayOrderId': razorpayOrderId });
        if (project) {
          const milestone = project.milestones.find(m => m.razorpayOrderId === razorpayOrderId);
          // Idempotency: only transition if still in CREATED state
          if (milestone && milestone.state === 'CREATED') {
            await MilestoneStateMachine.fund(milestone._id, razorpayPaymentId);
            console.log(`[webhook] milestone ${milestone._id} → FUNDED`);
          }
        }
      }

      if (payload.event === 'refund.processed') {
        const { payment_id } = payload.payload.refund.entity;
        // Set refundedAt timestamp when Razorpay confirms the refund settled
        const project = await Project.findOne({ 'milestones.razorpayPaymentId': payment_id });
        if (project) {
          const milestone = project.milestones.find(m => m.razorpayPaymentId === payment_id);
          if (milestone && !milestone.refundedAt) {
            milestone.refundedAt = new Date();
            await project.save();
            console.log(`[webhook] milestone ${milestone._id} refundedAt set`);
          }
        }
      }
    } catch (err) {
      // Log but always return 200 — Razorpay retries on non-200 responses,
      // which could cause duplicate transitions. We handle idempotency above.
      console.error('[webhook] processing error:', err.message);
    }

    res.status(200).json({ received: true });
  }
);

export default router;
