import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { ROLES } from '../constants/roles.js';
import { DEMO_USERS } from '../constants/guests.js';
import { ensureDemoData } from '../services/demo/ensureDemoData.js';

const router = Router();

// Throttle the public guest endpoint so it can't be hammered into a DB/CPU
// hot loop. Generous enough for real recruiters clicking around. Scoped to
// this one route — normal login/signup are unaffected.
const guestLimiter = rateLimit({
  windowMs:        60 * 1000, // 1 minute
  max:             10,        // 10 guest logins per IP per minute
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many guest logins — please wait a minute and try again.' },
});

// In production (Render backend ↔ Vercel frontend = cross-site), the cookie
// must be secure:true + sameSite:'none' so the browser sends it cross-origin.
// In development (same localhost) lax is fine and avoids needing HTTPS.
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: IS_PROD ? 'none' : 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
};

// Role is embedded in the token so requireAuth never needs a DB lookup.
// isGuest rides along the same way so blockGuests can run without a DB query.
function signToken(userId, role, isGuest = false) {
  return jwt.sign({ userId, role, isGuest }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
  res.status(201).json({ message: 'ok', user: { name: user.name, email: user.email, role: user.role, isGuest: !!user.isGuest } });
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

  res.cookie('token', signToken(user._id, user.role, user.isGuest), COOKIE_OPTS);
  res.json({ message: 'ok', user: { name: user.name, email: user.email, role: user.role, isGuest: !!user.isGuest } });
});

// POST /api/auth/guest — one-click demo login (no password).
// Finds the seeded demo user for the requested role and issues the SAME cookie
// + payload shape as /login, with isGuest:true. Run scripts/seedGuests.js first.
router.post('/guest', guestLimiter, async (req, res) => {
  const { role } = req.body;

  const demo = DEMO_USERS[role];
  if (!demo)
    return res.status(400).json({ error: 'role must be "client" or "freelancer"' });

  await ensureDemoData(); // no-op if already seeded; self-provisions on first hit

  const user = await User.findOne({ email: demo.email, isGuest: true });
  if (!user)
    return res.status(404).json({ error: 'Demo account not found — run "npm run seed:guests" first' });

  res.cookie('token', signToken(user._id, user.role, true), COOKIE_OPTS);
  res.json({
    message: 'ok',
    user: { name: user.name, email: user.email, role: user.role, isGuest: true },
  });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me — fetches fresh data from DB (catches role changes since last login)
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('name email role walletBalance isGuest');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

export default router;
