import { Router } from 'express'
import * as unionController from '../controllers/union.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

// My unions & invites
router.get('/mine',                          unionController.getMyUnions)
router.get('/invites',                       unionController.getPendingInvites)
router.post('/invites/:inviteId/respond',    unionController.respondToInvite)

// Union CRUD
router.post('/',                             unionController.createUnion)
router.get('/:id',                           unionController.getUnion)
router.patch('/:id', upload.single('avatar'), unionController.updateUnion)
router.delete('/:id',                        unionController.dissolveUnion)

// Invite from a union to a user
router.post('/:id/invite',                   unionController.sendInvite)

// Messaging between unions
router.get('/conversations',                 unionController.getUnionConversations)
router.get('/:fromId/messages/:toId',        unionController.getUnionMessages)
router.post('/:id/messages', upload.single('media'), unionController.sendUnionMessage)
router.post('/:fromId/messages/:toId/read',  unionController.markUnionRead)

export default router
