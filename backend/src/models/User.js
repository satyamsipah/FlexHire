import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    // 'admin' cannot be set via /signup — seed it directly in MongoDB Atlas
    role: { type: String, enum: Object.values(ROLES), required: true },

    // Escrow wallet — credited when a client funds a milestone, debited on payout
    walletBalance: { type: Number, default: 0 },

    // Demo accounts seeded for one-click "Explore as Guest" (scripts/seedGuests.js).
    // Guests are blocked from real-money / destructive actions — see middleware/blockGuests.js
    isGuest: { type: Boolean, default: false },

    // Razorpay Fund Account API — populated in Week 6 when a freelancer first gets paid
    razorpayContactId:     { type: String, default: null },
    razorpayFundAccountId: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
