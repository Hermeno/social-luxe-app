import { Router } from 'express'
import * as groupController from '../controllers/group.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/',                              groupController.getMyGroups)
router.post('/',                             groupController.createGroup)
router.get('/:id',                           groupController.getGroupInfo)
router.patch('/:id', upload.single('avatar'), groupController.updateGroup)
router.delete('/:id',                        groupController.deleteGroup)
router.get('/:id/messages',                  groupController.getGroupMessages)
router.post('/:id/messages',                 groupController.sendGroupMessage)
router.post('/:id/members',                  groupController.addMember)
router.delete('/:id/members/:userId',        groupController.removeMember)
router.post('/:id/admin',                    groupController.promoteToAdmin)
router.delete('/:id/leave',                  groupController.leaveGroup)

export default router
