import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as postController from '../controllers/post.controller'

// Router sem `authMiddleware`. É o único ponto da API alcançável sem sessão
// depois do /auth — vive em ficheiro próprio para que essa ausência seja uma
// decisão visível e não uma rota que escorregou para cima de um `router.use`.
const router = Router()

// Mais apertado que o limite geral (120/min): sem sessão a chave é só o IP, e
// isto atrasa a raspagem do acervo público. Não a impede — nada impede.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.get('/feed', publicLimiter, postController.getPublicFeed)

export default router
