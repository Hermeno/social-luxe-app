import { Router } from 'express'
import * as coinController from '../controllers/coin.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/balance', coinController.getBalance)
router.get('/history', coinController.getHistory)
router.post('/send', coinController.sendCoins)

export default router
