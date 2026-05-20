import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ROLES } from '../constants/roles.js';

const router = Router();

// httpOnly prevents JS from reading the cookie (XSS protection).
// sameSite:strict prevents the cookie from being sent on cross-site requests (CSRF protection).
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// Role is embedded in the token so requireAuth never needs a DB lookup.
function signToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password, and role are required' });

  // Admin accounts are seeded directly in MongoDB — not created via API
  if (role !== ROLES.CLIENT && role !== ROLES.FREELANCER)
    return res.status(400).json({ error: 'role must be "client" or "freelancer"' });

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, password: hashed, role });

  res.cookie('token', signToken(user._id, user.role), COOKIE_OPTS);
  res.status(201).json({ message: 'ok', user: { name: user.name, email: user.email, role: user.role } });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  res.cookie('token', signToken(user._id, user.role), COOKIE_OPTS);
  res.json({ message: 'ok', user: { name: user.name, email: user.email, role: user.role } });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me — fetches fresh data from DB (catches role changes since last login)
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('name email role walletBalance');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

export default router;
