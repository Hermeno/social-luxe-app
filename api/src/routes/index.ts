import { Router } from 'express'
import authRoutes from './auth.routes'
import postRoutes from './post.routes'
import userRoutes from './user.routes'
import messageRoutes from './message.routes'
import storyRoutes from './story.routes'
import bookmarkRoutes from './bookmark.routes'
import blockRoutes from './block.routes'
import reportRoutes from './report.routes'
import groupRoutes from './group.routes'
import highlightRoutes from './highlight.routes'
import challengeRoutes from './challenge.routes'
import coinRoutes from './coin.routes'
import momentoRoutes from './momento.routes'
import notificationRoutes from './notification.routes'
import friendshipRoutes from './friendship.routes'
import storeRoutes from './store.routes'
import donationRoutes from './donation.routes'
import travelRoutes from './travel.routes'
import unionRoutes from './union.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/posts', postRoutes)
router.use('/users', userRoutes)
router.use('/messages', messageRoutes)
router.use('/stories', storyRoutes)
router.use('/bookmarks', bookmarkRoutes)
router.use('/blocks', blockRoutes)
router.use('/reports', reportRoutes)
router.use('/groups', groupRoutes)
router.use('/highlights', highlightRoutes)
router.use('/challenges', challengeRoutes)
router.use('/coins', coinRoutes)
router.use('/momentos', momentoRoutes)
router.use('/notifications', notificationRoutes)
router.use('/friendships', friendshipRoutes)
router.use('/store', storeRoutes)
router.use('/donations', donationRoutes)
router.use('/travel', travelRoutes)
router.use('/unions', unionRoutes)

export default router
