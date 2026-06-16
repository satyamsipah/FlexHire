import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Parses the httpOnly 'token' cookie from the Socket.io handshake headers,
// verifies the JWT, and attaches userId / userRole / userName to the socket.
// document.cookie cannot read httpOnly cookies — we must parse the raw header.
export async function socketAuth(socket, next) {
  const raw     = socket.handshake.headers.cookie || '';
  const cookies = cookie.parse(raw);
  const token   = cookies.token;

  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.userId).select('name role').lean();
    if (!user) return next(new Error('User not found'));

    socket.userId   = decoded.userId;
    socket.userRole = decoded.role;
    socket.userName = user.name;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}
