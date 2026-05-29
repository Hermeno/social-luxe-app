import { io, Socket } from 'socket.io-client'
import { SOCKET_URL } from '../config'
let socket: Socket | null = null

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket
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
