import { Router } from 'express'
import * as userController from '../controllers/user.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', userController.getAllUsers)
router.get('/search', userController.searchUsers)
router.get('/:id', userController.getUserById)
router.get('/:id/posts', userController.getUserPosts)
router.put('/profile', upload.single('avatar'), userController.updateProfile)

export default router
