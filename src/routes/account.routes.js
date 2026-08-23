import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { authenticateToken } from '../middleware/authenticateToken.js'
import {
  createAccount,
  deleteAccount,
  findAccountsByUser,
  payAccount,
  updateAccount,
} from '../repositories/accountRepository.js'

const router = Router()
router.use(authenticateToken)

router.get('/', asyncHandler(async (req, res) => {
  return res.json(await findAccountsByUser(req.user.id))
}))

router.post('/', asyncHandler(async (req, res) => {
  return res.status(201).json(await createAccount(req.user.id, req.body))
}))

router.put('/:id', asyncHandler(async (req, res) => {
  return res.json(await updateAccount(req.params.id, req.user.id, req.body))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  await deleteAccount(req.params.id, req.user.id)
  return res.status(204).send()
}))

router.patch('/:id/payment', asyncHandler(async (req, res) => {
  const { paymentDate, paymentMethod } = req.body
  const validMethods = ['PIX', 'DINHEIRO', 'CARTAO']

  if (!paymentDate || !validMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: 'Data e forma de pagamento são obrigatórias' })
  }

  return res.json(await payAccount(req.params.id, req.user.id, { paymentDate, paymentMethod }))
}))

export default router
