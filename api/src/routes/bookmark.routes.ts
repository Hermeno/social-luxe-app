import { Router } from 'express'
import * as bookmarkController from '../controllers/bookmark.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', bookmarkController.getBookmarks)
router.post('/', bookmarkController.toggleBookmark)

export default router
