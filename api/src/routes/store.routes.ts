import { Router } from 'express'
import * as storeController from '../controllers/store.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

const router = Router()

router.use(authMiddleware)

router.get('/',                    storeController.getProducts)
router.get('/seller/:sellerId',    storeController.getProductsBySeller)
router.get('/:id',                 storeController.getProductById)
router.post('/',                   storeController.createProduct)
router.patch('/:id',               storeController.updateProduct)
router.patch('/:id/toggle',        storeController.toggleProductStatus)
router.delete('/:id',              storeController.deleteProduct)
router.post('/:id/save',           storeController.saveProduct)

export default router
