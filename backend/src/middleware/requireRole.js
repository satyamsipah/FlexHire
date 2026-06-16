// Higher-order function (HOF) that returns an Express middleware.
// Usage: router.post('/', requireAuth, requireRole('client'), handler)
// requireRole MUST come after requireAuth — it reads req.userRole set by requireAuth.
//
// Example: requireRole('client', 'admin') allows both clients and admins.
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}
