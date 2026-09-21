import { Router } from 'express'
import * as circleController from '../controllers/circle.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

// Sessão de foto em grupo, ao vivo com pessoas próximas
router.post('/open',        circleController.open)
router.get('/incoming',     circleController.incoming)
router.post('/call',        circleController.call)
router.post('/join',        circleController.join)
router.post('/leave',       circleController.leave)
router.post('/remove',      circleController.remove)
router.post('/photo',       upload.single('media'), circleController.photo)
router.post('/photo/withdraw', circleController.withdrawPhoto)
router.post('/countdown',   circleController.countdown)
router.post('/publish',     circleController.publish)
router.get('/session/:id',  circleController.state)

// Círculo publicado: quem não esteve lá pede para entrar, o anfitrião decide, e
// qualquer pessoa retira as próprias fotografias.
router.post('/moments/:momentId/join',          upload.single('media'), circleController.requestJoin)
router.post('/moments/:momentId/remove-photos', circleController.removeMomentPhotos)
router.get('/join-requests/incoming',           circleController.incomingJoins)
router.get('/join-requests/mine',               circleController.myJoins)
router.post('/join-requests/:requestId/decision', circleController.decideJoin)
router.delete('/join-requests/:requestId',      circleController.cancelJoin)

export default router
