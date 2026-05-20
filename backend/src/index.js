import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';

const app = express();
const httpServer = createServer(app); // wrap Express so Socket.io can share the port
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Socket.io — same CORS origin as Express so httpOnly cookies are forwarded
export const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, credentials: true },
});

// Week 7: authenticate sockets via httpOnly cookie using cookie-parser on the namespace
io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);
  socket.on('disconnect', () => console.log('socket disconnected:', socket.id));
});

// IMPORTANT (Week 6): register any Razorpay webhook route BEFORE express.json().
// Razorpay HMAC signature verification requires the raw request body buffer.
// Once express.json() parses it, the raw buffer is gone and signature check will fail.

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth',     authRoutes);
app.use('/api/projects', projectRoutes);

// Global error handler — catches any unhandled async errors thrown in route handlers
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

connectDB().then(() => {
  httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
