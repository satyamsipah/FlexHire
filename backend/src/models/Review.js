import mongoose from 'mongoose';
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    projectId:  { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    toUserId:   { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    rating:     { type: Number, min: 1, max: 5, required: true },
    comment:    { type: String, default: '' },
  },
  { timestamps: true }
);

// Each user can only review another user once per project
reviewSchema.index({ projectId: 1, fromUserId: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
