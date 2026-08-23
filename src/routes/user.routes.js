import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { authenticateToken } from '../middleware/authenticateToken.js'
import { findAllUsers } from '../repositories/userRepository.js'

const router = Router()

router.get('/', authenticateToken, asyncHandler(async (_req, res) => {
  return res.json(await findAllUsers())
}))

export default router
