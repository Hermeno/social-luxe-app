import { Router } from 'express'
import * as friendshipController from '../controllers/friendship.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/', friendshipController.getFriends)
router.get('/level/:userId', friendshipController.getFriendshipLevel)
router.post('/', friendshipController.sendRequest)
router.put('/:id/renew', friendshipController.renewFriendship)
router.delete('/:id', friendshipController.removeFriendship)

export default router
