import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema(
  {
    // References the _id of a MilestoneSchema subdoc — NOT a separate collection
    milestoneId: { type: mongoose.Schema.Types.ObjectId, required: true },
    projectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    raisedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason:      { type: String, required: true },
    resolution:  { type: String, default: null },
    resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt:  { type: Date,   default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Dispute', disputeSchema);
