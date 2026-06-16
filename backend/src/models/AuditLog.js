import mongoose from 'mongoose';

// Immutable event log — written whenever a significant state change occurs
// (e.g., milestone approved, dispute raised, payout initiated). Week 6+ will
// write to this from the EscrowStateMachine.
const auditLogSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action:     { type: String, required: true },
  entityType: { type: String, required: true }, // 'Project' | 'Milestone' | 'Dispute'
  entityId:   { type: mongoose.Schema.Types.ObjectId, required: true },
  metadata:   { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp:  { type: Date, default: Date.now },
});

export default mongoose.model('AuditLog', auditLogSchema);
