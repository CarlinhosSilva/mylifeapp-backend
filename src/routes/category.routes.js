import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { authenticateToken } from '../middleware/authenticateToken.js'
import { findAllCategories } from '../repositories/categoryRepository.js'

const router = Router()

router.get('/', authenticateToken, asyncHandler(async (_req, res) => {
  return res.json(await findAllCategories())
}))

export default router
