import { Router } from 'express'
import * as messageController from '../controllers/message.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/conversations', messageController.getConversations)
router.get('/:userId', messageController.getMessages)
router.post('/', upload.single('media'), messageController.sendMessage)

export default router
