import { Router } from 'express'
import * as storyController from '../controllers/story.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', storyController.getFriendsStories)
router.post('/', upload.single('media'), storyController.createStory)
router.delete('/:id', storyController.deleteStory)
router.post('/:id/view', storyController.viewStory)

export default router
