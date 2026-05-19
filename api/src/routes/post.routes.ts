import { Router } from 'express'
import * as postController from '../controllers/post.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/feed', postController.getFeed)
router.post('/', upload.single('media'), postController.createPost)
router.delete('/:id', postController.deletePost)
router.post('/:id/like', postController.likePost)
router.post('/:id/view', postController.addView)
router.get('/:id/comments', postController.getComments)
router.post('/:id/comments', postController.addComment)

export default router
