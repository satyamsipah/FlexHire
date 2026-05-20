import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import milestoneRoutes from './routes/milestones.js';
import disputeRoutes from './routes/disputes.js';
import webhookRoutes from './routes/webhooks.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

export const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, credentials: true },
});

// Week 7: authenticate sockets via httpOnly cookie using cookie-parser on the namespace
io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);
  socket.on('disconnect', () => console.log('socket disconnected:', socket.id));
});

// ─── Webhook BEFORE express.json() ───────────────────────────────────────────
// Razorpay HMAC signature verification needs the raw request body buffer.
// express.json() destroys it — so the webhook route uses express.raw() internally
// and must be registered first.
app.use('/api/webhooks', webhookRoutes);

// ─── All other middleware ─────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth',       authRoutes);
app.use('/api/projects',   projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/disputes',   disputeRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
// err.status is set by InvalidTransitionError (409) and our 404 helpers.
// Falls back to 500 for unexpected errors.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message || 'Internal server error' });
});

connectDB().then(() => {
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
