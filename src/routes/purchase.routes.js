import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { authenticateToken } from '../middleware/authenticateToken.js'
import multer from 'multer'
import { createPurchase, deletePurchase, findPurchaseNoteByUser, findPurchasesByUser, getPurchaseMonthlySummary, getPurchaseReport } from '../repositories/purchaseRepository.js'
import { parsePurchaseTotal } from '../utils/purchase.js'

const router = Router()
router.use(authenticateToken)

const uploadNote = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 3, fieldSize: 4096, parts: 4 },
}).single('note')

function handleNoteUpload(req, res, next) {
  uploadNote(req, res, error => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') error.statusCode = 413
      else if (error instanceof multer.MulterError) error.statusCode = 400
      return next(error)
    }
    return next()
  })
}

function getVerifiedImageMimeType(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return null
}

router.get('/', asyncHandler(async (req, res) => {
  return res.json(await findPurchasesByUser(req.user.id))
}))

router.get('/:id/note', asyncHandler(async (req, res) => {
  const note = await findPurchaseNoteByUser(req.params.id, req.user.id)
  if (!note?.note_image) {
    return res.status(404).json({ error: 'Imagem da nota não encontrada' })
  }

  res.set('Content-Type', note.note_image_mime)
  res.set('Content-Disposition', 'inline; filename="nota-compra"')
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('Cache-Control', 'private, no-store')
  return res.send(note.note_image)
}))

router.get('/monthly-summary', asyncHandler(async (req, res) => {
  return res.json(await getPurchaseMonthlySummary(req.user.id))
}))

router.get('/report', asyncHandler(async (req, res) => {
  return res.json(await getPurchaseReport(req.user.id))
}))

router.post('/', handleNoteUpload, asyncHandler(async (req, res) => {
  const { supplierName, totalValue, purchaseDate } = req.body

  const verifiedMimeType = req.file ? getVerifiedImageMimeType(req.file.buffer) : null
  if (req.file && (!verifiedMimeType || verifiedMimeType !== req.file.mimetype)) {
    return res.status(400).json({ error: 'Envie uma imagem JPG, PNG ou WEBP válida' })
  }

  const normalizedSupplier = typeof supplierName === 'string' ? supplierName.trim() : ''
  const numericTotal = parsePurchaseTotal(totalValue)
  const parsedDate = typeof purchaseDate === 'string' ? new Date(`${purchaseDate}T00:00:00Z`) : null
  const validDate = typeof purchaseDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)
    && parsedDate
    && !Number.isNaN(parsedDate.getTime())
    && parsedDate.toISOString().slice(0, 10) === purchaseDate

  if (!normalizedSupplier) {
    return res.status(400).json({ error: 'Informe o fornecedor da compra' })
  }
  if (normalizedSupplier.length > 200) {
    return res.status(400).json({ error: 'O fornecedor deve ter no máximo 200 caracteres' })
  }
  if (!validDate) {
    return res.status(400).json({ error: 'Informe uma data de compra válida' })
  }
  if (!Number.isFinite(numericTotal) || numericTotal <= 0 || numericTotal > 9999999999.99) {
    return res.status(400).json({ error: 'Informe um valor total positivo de até R$ 9.999.999.999,99' })
  }

  const payload = {
    supplierName: normalizedSupplier,
    totalValue: numericTotal,
    purchaseDate,
    items: [],
    noteText: '',
    rawText: '',
    noteImage: req.file?.buffer ?? null,
    noteImageMime: verifiedMimeType,
  }

  return res.status(201).json(await createPurchase(req.user.id, payload))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  await deletePurchase(req.params.id, req.user.id)
  return res.status(204).send()
}))

export default router
