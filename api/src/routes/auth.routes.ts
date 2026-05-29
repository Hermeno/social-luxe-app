import { Router } from 'express'
import * as authController from '../controllers/auth.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.post('/check-phone',            authController.checkPhone)
router.post('/register',               authController.register)
router.post('/login',                  authController.login)
router.get('/me',  authMiddleware,     authController.me)
router.put('/change-password', authMiddleware, authController.changePassword)
router.post('/forgot-password',        authController.requestPasswordReset)
router.post('/reset-password',         authController.confirmPasswordReset)
router.delete('/account', authMiddleware, authController.deleteAccount)

export default router
