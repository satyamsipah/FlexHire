import mongoose from 'mongoose';
import { PROJECT_STATES, MILESTONE_STATES } from '../constants/roles.js';

// Milestone is embedded inside Project (subdoc), not its own collection.
// This lets us load a project + all its milestones in a single Mongo query.
// Access a specific milestone by: project.milestones.id(milestoneId)
const MilestoneSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true },
    description: { type: String, required: true },
    amount:      { type: Number, required: true, min: 0 },
    state:       { type: String, enum: MILESTONE_STATES, default: 'CREATED' },

    // Populated by Razorpay integration in Week 6
    razorpayOrderId:   { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpayPayoutId:  { type: String, default: null },

    // Freelancer's note when submitting work for review
    submissionNote: { type: String, default: null },

    submittedAt: { type: Date, default: null },
    approvedAt:  { type: Date, default: null },
    refundedAt:  { type: Date, default: null },
  },
  { _id: true } // each milestone gets its own _id so we can find it by ID
);

const projectSchema = new mongoose.Schema(
  {
    clientId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // null until a freelancer accepts the project
    freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    title:       { type: String, required: true, trim: true },
    description: { type: String, required: true },
    totalBudget: { type: Number, required: true, min: 0 },

    state:      { type: String, enum: PROJECT_STATES, default: 'POSTED' },
    milestones: [MilestoneSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
