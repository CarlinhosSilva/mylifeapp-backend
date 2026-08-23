import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { authenticateToken } from '../middleware/authenticateToken.js'
import { createIncome, deleteIncome, findIncomesByUser, getBalanceByUser, getCurrentMonthSummary, getFamilySummary, getFinancialStatus } from '../repositories/incomeRepository.js'

const router = Router()
router.use(authenticateToken)

router.get('/', asyncHandler(async (req, res) => {
  return res.json(await findIncomesByUser(req.user.id))
}))

router.get('/balance', asyncHandler(async (req, res) => {
  return res.json(await getBalanceByUser(req.user.id))
}))

router.get('/monthly-summary', asyncHandler(async (req, res) => {
  return res.json(await getCurrentMonthSummary(req.user.id))
}))

router.get('/family-summary', asyncHandler(async (_req, res) => {
  return res.json(await getFamilySummary())
}))

router.get('/financial-status', asyncHandler(async (req, res) => {
  const userId = req.query.scope === 'family' ? null : req.user.id
  return res.json(await getFinancialStatus(userId))
}))

router.post('/', asyncHandler(async (req, res) => {
  const { description, value, receivedDate } = req.body

  if (!description || value == null || !receivedDate) {
    return res.status(400).json({ error: 'Descrição, valor e data são obrigatórios' })
  }

  return res.status(201).json(await createIncome(req.user.id, { description, value, receivedDate }))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  await deleteIncome(req.params.id, req.user.id)
  return res.status(204).send()
}))

export default router