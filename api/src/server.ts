import { createServer } from 'http'
import app from './app'
import { env } from './config/env'
import { setupSocket } from './socket'
import { startCleanupJob } from './jobs/cleanup.job'
import { startFriendshipJob } from './jobs/friendship.job'

const httpServer = createServer(app)
setupSocket(httpServer)

httpServer.listen(env.port, '0.0.0.0', () => {
  console.log(`[Server] Running on 0.0.0.0:${env.port} [${env.nodeEnv}]`)
  console.log(`[Server] Network: http://192.168.43.184:${env.port}`)
  startCleanupJob()
  startFriendshipJob()
})
