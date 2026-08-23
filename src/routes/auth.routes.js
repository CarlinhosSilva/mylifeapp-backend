import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { authenticateToken } from '../middleware/authenticateToken.js'
import { login, register, updateProfile } from '../services/authService.js'

const router = Router()

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha e-mail e senha' })
  }

  return res.json(await login({ email: email.trim().toLowerCase(), password }))
}))

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body

  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Preencha todos os campos' })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'As senhas não coincidem' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
  }

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'E-mail inválido' })
  }

  const user = await register({ name: name.trim(), email: email.trim().toLowerCase(), password })
  return res.status(201).json(user)
}))

router.put('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const { email, password, name } = req.body

  if (email === undefined && password === undefined && name === undefined) {
    return res.status(400).json({ error: 'Nenhuma alteração informada' })
  }

  if (password != null && password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
  }

  const updatedUser = await updateProfile(req.user.id, {
    email: email?.trim().toLowerCase(),
    password,
    name: name?.trim(),
  })

  return res.json(updatedUser)
}))

export default router
