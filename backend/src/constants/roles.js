// Single source of truth for all enum strings.
// Import these in models and middleware — never hardcode the raw strings.
export const ROLES = {
  CLIENT:     'client',
  FREELANCER: 'freelancer',
  ADMIN:      'admin',
};

export const PROJECT_STATES = [
  'POSTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
];

// NOTE: Add 'AUTO_REFUNDED' here at the start of Week 6 — it is the terminal
// state written by the Razorpay webhook when an order expires unfunded.
export const MILESTONE_STATES = [
  'CREATED', 'FUNDED', 'IN_PROGRESS', 'SUBMITTED',
  'APPROVED', 'DISPUTED', 'REFUNDED', 'CANCELLED',
];
