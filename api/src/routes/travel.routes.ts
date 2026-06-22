import { Router } from 'express'
import * as travelController from '../controllers/travel.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

// GET  /travel/:postId          — full travel data (nodes + objects + stats)
router.get('/:postId',                   travelController.getTravelData)

// POST /travel/:postId/objects  — add a travel object
router.post('/:postId/objects',          travelController.addObject)

// DELETE /travel/objects/:objectId — remove a travel object
router.delete('/objects/:objectId',      travelController.removeObject)

export default router
