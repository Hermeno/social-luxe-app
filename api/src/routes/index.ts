import { Router } from 'express'
import authRoutes from './auth.routes'
import postRoutes from './post.routes'
import userRoutes from './user.routes'
import friendshipRoutes from './friendship.routes'
import messageRoutes from './message.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/posts', postRoutes)
router.use('/users', userRoutes)
router.use('/friendships', friendshipRoutes)
router.use('/messages', messageRoutes)

export default router
