import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import accountRoutes from './routes/account.routes.js'
import userRoutes from './routes/user.routes.js'
import categoryRoutes from './routes/category.routes.js'
import incomeRoutes from './routes/income.routes.js'
import purchaseRoutes from './routes/purchase.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()

  app.use(cors({
    origin: env.frontendUrl,
    credentials: true,
  }))
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api', authRoutes)
  app.use('/api/accounts', accountRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/categories', categoryRoutes)
  app.use('/api/incomes', incomeRoutes)
  app.use('/api/purchases', purchaseRoutes)

  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado' })
  })

  app.use(errorHandler)

  return app
}
