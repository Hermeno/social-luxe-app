import { Router } from 'express'
import * as groupController from '../controllers/group.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', groupController.getMyGroups)
router.post('/', groupController.createGroup)
router.get('/:id/messages', groupController.getGroupMessages)
router.post('/:id/messages', groupController.sendGroupMessage)
router.post('/:id/members', groupController.addMember)
router.delete('/:id/members/:userId', groupController.removeMember)

export default router
