// Blocks seeded demo accounts from destructive / real-money actions.
// Reads req.isGuest, which requireAuth sets from the JWT payload — so this
// runs with no DB lookup. Chain it AFTER requireAuth:
//   router.post('/x', requireAuth, requireRole(...), blockGuests, handler)
//
// Currently applied to the only real-money route (milestone funding). Drop it
// onto any future account-delete / change-email / change-password route too.
export function blockGuests(req, res, next) {
  if (req.isGuest) {
    return res.status(403).json({ error: 'This action is disabled in demo mode' });
  }
  next();
}
