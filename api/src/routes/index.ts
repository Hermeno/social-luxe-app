import { Router } from 'express'
import authRoutes from './auth.routes'
import postRoutes from './post.routes'
import userRoutes from './user.routes'
import messageRoutes from './message.routes'
import storyRoutes from './story.routes'
import blockRoutes from './block.routes'
import reportRoutes from './report.routes'
import notificationRoutes from './notification.routes'
import friendshipRoutes from './friendship.routes'
import donationRoutes from './donation.routes'
import unionRoutes from './union.routes'
import pairingRoutes from './pairing.routes'
import circleRoutes from './circle.routes'
import halfRoutes from './half.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/posts', postRoutes)
router.use('/users', userRoutes)
router.use('/messages', messageRoutes)
router.use('/stories', storyRoutes)
router.use('/blocks', blockRoutes)
router.use('/reports', reportRoutes)
router.use('/notifications', notificationRoutes)
router.use('/friendships', friendshipRoutes)
router.use('/donations', donationRoutes)
router.use('/unions', unionRoutes)
router.use('/pairings', pairingRoutes)
router.use('/circle', circleRoutes)
router.use('/halves', halfRoutes)

export default router
