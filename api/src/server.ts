import app from './app'
import { env } from './config/env'
import { startCleanupJob } from './jobs/cleanup.job'
import { startFriendshipJob } from './jobs/friendship.job'

app.listen(env.port, '0.0.0.0', () => {
  console.log(`[Server] Running on 0.0.0.0:${env.port} [${env.nodeEnv}]`)
  console.log(`[Server] Network: http://192.168.43.184:${env.port}`)
  startCleanupJob()
  startFriendshipJob()
})
