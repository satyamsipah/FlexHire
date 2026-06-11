import jwt from 'jsonwebtoken';

// Reads the JWT from the httpOnly cookie 'token'.
// Attaches req.userId and req.userRole for use by downstream route handlers.
// Role comes from the token payload — no DB query on every request.
// (The token is refreshed on every login/signup, so role is current as of last sign-in.)
export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId   = payload.userId;
    req.userRole = payload.role;
    req.isGuest  = payload.isGuest === true; // demo accounts — see middleware/blockGuests.js
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
