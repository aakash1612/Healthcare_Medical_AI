import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL;
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      forceNew: false,     // 🌟 CRITICAL: Prevent spawning redundant connection handles
      reconnection: true,  // Allow stable recovery
      reconnectionAttempts: 5
    });
    
    socket.on('connect', () => console.log('[Socket] Connected:', socket?.id));
    socket.on('disconnect', () => console.log('[Socket] Disconnected'));
    socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));
  }
  return socket;
}

export function joinSession(sessionId: string) {
  const s = getSocket();
  console.log(`[Socket] Sending join:session for room: ${sessionId} using socket ID: ${s.id}`);
  s.emit('join:session', sessionId);
}

export function sendChatMessage(sessionId: string, question: string) {
  getSocket().emit('chat:message', { sessionId, question });
}