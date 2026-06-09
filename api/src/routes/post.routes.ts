import { Router } from 'express'
import * as postController from '../controllers/post.controller'
import * as reactionController from '../controllers/reaction.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { upload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/feed',            postController.getFeed)
router.get('/flashback',       postController.getFlashback)
router.get('/partner-pending', postController.getPartnerPostInvites)
router.put('/:id/partner-accept', postController.acceptPostPartner)
router.put('/:id/partner-reject', postController.rejectPostPartner)
router.post('/', upload.single('media'), postController.createPost)
router.delete('/:id', postController.deletePost)
router.patch('/:id', postController.updatePost)
router.post('/:id/like', postController.likePost)
router.post('/:id/view', postController.addView)
router.post('/:id/share', postController.sharePost)
router.post('/:id/vote-extend', postController.voteExtendPost)
router.get('/:id/extend-votes', postController.getExtendVotes)
router.get('/:id/comments', postController.getComments)
router.post('/:id/comments', postController.addComment)
router.post('/:id/react', reactionController.react)
router.delete('/:id/react', reactionController.removeReaction)
router.get('/:id/reactions', reactionController.getReactions)

export default router
