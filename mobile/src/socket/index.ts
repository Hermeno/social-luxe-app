import { io, Socket } from 'socket.io-client'
import { SOCKET_URL } from '../config'
let socket: Socket | null = null

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket
  // Disconnect any stale instance left over from a previous JS context (Expo Go reload)
  if (socket) { try { socket.disconnect() } catch {}; socket = null }
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  })
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function getSocket(): Socket | null { return socket }
