import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    senderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    content:   { type: String, required: true },
    // Cloudinary URLs — populated in Week 7 when file upload is added
    attachments: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
