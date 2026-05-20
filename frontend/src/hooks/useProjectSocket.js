import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const MILESTONE_EVENTS = [
  'milestone:funded',
  'milestone:started',
  'milestone:submitted',
  'milestone:approved',
  'milestone:disputed',
  'milestone:refunded',
  'milestone:auto_refunded',
  'milestone:cancelled',
];

// Connects to the /chat Socket.io namespace for a given projectId.
// Auth via httpOnly cookie — the server verifies JWT on the handshake.
export function useProjectSocket({ projectId, onMessage, onTyping, onMilestoneEvent, onPresence }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    const socket = io('/chat', { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_project', { projectId });
    });

    socket.on('connect_error', err => {
      console.warn('[socket] connect error:', err.message);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('message:new',    msg  => onMessage?.(msg));
    socket.on('message:typing', data => onTyping?.(data));
    socket.on('user:joined',    data => onPresence?.('joined', data));
    socket.on('user:left',      data => onPresence?.('left', data));

    MILESTONE_EVENTS.forEach(event => {
      socket.on(event, data => onMilestoneEvent?.(event, data));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(({ content, attachments = [] }) => {
    socketRef.current?.emit('message:send', { projectId, content, attachments });
  }, [projectId]);

  const sendTyping = useCallback(() => {
    socketRef.current?.emit('message:typing', { projectId });
  }, [projectId]);

  return { connected, sendMessage, sendTyping };
}
