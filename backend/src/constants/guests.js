import { ROLES } from './roles.js';

// Single source of truth for the two seeded demo accounts used by the
// one-click "Explore as Guest" flow. Imported by:
//   - routes/auth.js      → POST /api/auth/guest looks the user up by role
//   - scripts/seedGuests.js → upserts these users + demo data
// The `.demo` TLD is intentionally non-routable so these can never collide
// with a real signup email.
export const DEMO_USERS = {
  [ROLES.CLIENT]: {
    name:  'Demo Client',
    email: 'demo-client@flexhire.demo',
    role:  ROLES.CLIENT,
  },
  [ROLES.FREELANCER]: {
    name:  'Demo Freelancer',
    email: 'demo-freelancer@flexhire.demo',
    role:  ROLES.FREELANCER,
  },
};
