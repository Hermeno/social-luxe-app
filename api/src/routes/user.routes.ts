import { Router } from 'express'
import * as userController from '../controllers/user.controller'
import * as followController from '../controllers/follow.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

// Static routes MUST come before /:id
router.get('/', userController.getAllUsers)
router.get('/search', userController.searchUsers)
router.get('/connections', userController.getConnections)
router.get('/suggested', userController.getSuggestedUsers)
router.get('/followers/count', followController.getMyFollowerCount)
router.get('/followers', followController.getMyFollowers)
router.get('/following', followController.getMyFollowing)
router.put('/profile', upload.single('avatar'), userController.updateProfile)
router.put('/interests', userController.updateInterests)
router.put('/ghost-mode', userController.toggleGhostMode)
router.get('/:id', userController.getUserById)
router.get('/:id/posts', userController.getUserPosts)
router.get('/:id/followers', followController.getUserFollowers)
router.get('/:id/following', followController.getUserFollowing)
router.post('/:id/follow', followController.followUser)
router.get('/:id/follow-status', followController.getFollowStatus)

export default router
