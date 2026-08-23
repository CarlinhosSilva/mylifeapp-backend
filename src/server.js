import { createApp } from './app.js'
import { env } from './config/env.js'
import { initializeDatabase } from './db.js'

await initializeDatabase()

const app = createApp()
app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`)
})
