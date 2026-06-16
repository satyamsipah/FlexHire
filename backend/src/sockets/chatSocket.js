import Project from '../models/Project.js';
import Message from '../models/Message.js';
import { socketAuth } from '../middleware/socketAuth.js';
import { ROLES } from '../constants/roles.js';

let chatNs;

// Called once from index.js — sets up the /chat namespace and returns it.
export function initChatSocket(io) {
  chatNs = io.of('/chat');
  chatNs.use(socketAuth);

  chatNs.on('connection', socket => {

    // Client emits 'join_project' to subscribe to a project's room.
    // Only the project's client, assigned freelancer, or admin may join.
    socket.on('join_project', async ({ projectId }) => {
      try {
        const project = await Project
          .findById(projectId)
          .select('clientId freelancerId')
          .lean();
        if (!project) return;

        const isClient     = project.clientId?.toString() === socket.userId;
        const isFreelancer = project.freelancerId?.toString() === socket.userId;
        const isAdmin      = socket.userRole === ROLES.ADMIN;
        if (!isClient && !isFreelancer && !isAdmin) return;

        socket.join(`project:${projectId}`);
        // Tell others in the room this user is online
        socket.to(`project:${projectId}`).emit('user:joined', {
          userId: socket.userId,
          name:   socket.userName,
        });
      } catch (err) {
        console.error('[socket] join_project:', err.message);
      }
    });

    // Persist and broadcast a chat message.
    socket.on('message:send', async ({ projectId, content, attachments = [] }) => {
      try {
        if (!socket.rooms.has(`project:${projectId}`)) return;
        if (!content?.trim() && attachments.length === 0) return;

        const msg = await Message.create({
          projectId,
          senderId:    socket.userId,
          content:     content?.trim() ?? '',
          attachments,
        });
        const populated = await msg.populate('senderId', 'name role');

        chatNs.to(`project:${projectId}`).emit('message:new', populated);
      } catch (err) {
        console.error('[socket] message:send:', err.message);
      }
    });

    // Typing indicator — broadcast to everyone else in the room.
    socket.on('message:typing', ({ projectId }) => {
      if (!socket.rooms.has(`project:${projectId}`)) return;
      socket.to(`project:${projectId}`).emit('message:typing', {
        userId: socket.userId,
        name:   socket.userName,
      });
    });

    socket.on('disconnect', () => {
      socket.rooms.forEach(room => {
        if (room.startsWith('project:')) {
          socket.to(room).emit('user:left', { userId: socket.userId });
        }
      });
    });
  });

  return chatNs;
}

// Route handlers call this after each milestone state transition.
// Delivers a milestone event to everyone in the project's socket room.
export function emitToProject(projectId, event, data) {
  chatNs?.to(`project:${projectId}`).emit(event, data);
}
