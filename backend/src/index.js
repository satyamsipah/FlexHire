import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createAdapter } from '@socket.io/redis-adapter';
import { connectDB } from './config/db.js';
import { createRedisClients } from './config/redis.js';
import { initChatSocket } from './sockets/chatSocket.js';
import { ensureDemoData } from './services/demo/ensureDemoData.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import milestoneRoutes from './routes/milestones.js';
import disputeRoutes from './routes/disputes.js';
import webhookRoutes from './routes/webhooks.js';
import uploadRoutes from './routes/uploads.js';
import reviewRoutes from './routes/reviews.js';

const app = express();
// Trust the first proxy hop (Render/Vercel) so req.ip — and therefore
// express-rate-limit's per-client keying — sees the real client address,
// not the proxy's. '1' (not `true`) keeps it from being permissively trusting.
app.set('trust proxy', 1);
const httpServer = createServer(app);
const PORT           = process.env.PORT       || 5001;
// FRONTEND_URL is set in Render/production; CLIENT_URL is the legacy dev alias
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

export const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGIN, credentials: true },
});

// Wire Redis adapter for horizontal scalability.
// Gracefully skipped if REDIS_URL is not configured.
const redisClients = createRedisClients();
if (redisClients) {
  io.adapter(createAdapter(redisClients.pubClient, redisClients.subClient));
  console.log('[redis] Socket.io Redis adapter active');
}

// Mount authenticated /chat namespace
initChatSocket(io);

// ─── Health check (used by Render to confirm successful deployment) ──────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Webhook BEFORE express.json() ───────────────────────────────────────────
// Razorpay HMAC signature verification needs the raw request body buffer.
// express.json() destroys it — so the webhook route uses express.raw() internally
// and must be registered first.
app.use('/api/webhooks', webhookRoutes);

// ─── All other middleware ─────────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth',       authRoutes);
app.use('/api/projects',   projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/disputes',   disputeRoutes);
app.use('/api/uploads',    uploadRoutes);
app.use('/api/reviews',    reviewRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message || 'Internal server error' });
});

connectDB().then(() => {
  ensureDemoData().catch((err) => console.warn('[demo] ensureDemoData failed on boot:', err));
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
