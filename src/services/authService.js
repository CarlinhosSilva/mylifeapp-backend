import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { createUser, findUserByEmail, updateUser } from '../repositories/userRepository.js'

const jwtExpiresIn = '8h'

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    env.jwtSecret,
    { expiresIn: jwtExpiresIn },
  )
}

export async function login({ email, password }) {
  const user = await findUserByEmail(email)
  if (!user || !(await bcrypt.compare(password, user.password))) {
    const error = new Error('Credenciais inválidas')
    error.statusCode = 401
    throw error
  }

  return { name: user.name, email: user.email, token: createToken(user) }
}

export async function register({ name, email, password }) {
  const existingUser = await findUserByEmail(email)
  if (existingUser) {
    const error = new Error('E-mail já cadastrado')
    error.statusCode = 409
    throw error
  }

  const user = await createUser({
    name,
    email,
    password: await bcrypt.hash(password, 10),
  })

  return { name: user.name, email: user.email, token: createToken(user) }
}

export async function updateProfile(userId, data) {
  const updates = { ...data }

  if (updates.password != null) {
    updates.password = await bcrypt.hash(updates.password, 10)
  }

  const user = await updateUser(userId, updates)
  if (!user) {
    const error = new Error('Usuário não encontrado')
    error.statusCode = 404
    throw error
  }

  return { name: user.name, email: user.email, token: createToken(user) }
}
