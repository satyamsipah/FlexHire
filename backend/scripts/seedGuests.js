// Seeds demo accounts + realistic demo data for the one-click guest flow.
// Run from the backend/ directory: npm run seed:guests
//
// Always does a full scoped wipe-and-reseed (same behaviour as before).
// For idempotent provisioning (no wipe) use ensureDemoData() without reset flag.
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { ensureDemoData } from '../src/services/demo/ensureDemoData.js';
import { DEMO_USERS } from '../src/constants/guests.js';
import { ROLES } from '../src/constants/roles.js';
import User from '../src/models/User.js';
import Project from '../src/models/Project.js';

async function run() {
  await connectDB();
  await ensureDemoData({ reset: true });

  const client   = await User.findOne({ email: DEMO_USERS[ROLES.CLIENT].email });
  const freelancer = await User.findOne({ email: DEMO_USERS[ROLES.FREELANCER].email });
  const escrow   = await Project.findOne({ clientId: client._id, state: 'IN_PROGRESS' });

  console.log('\n✅ Guest demo data seeded:');
  console.table([
    { role: client.role,     email: client.email,     id: client._id.toString() },
    { role: freelancer.role, email: freelancer.email, id: freelancer._id.toString() },
  ]);
  console.log(`   Open job posts: 3 (POSTED)`);
  console.log(`   Mid-escrow project: "${escrow?.title}" (${escrow?._id})`);
  console.log(`   Freelancer wallet balance: ₹${freelancer.walletBalance}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
