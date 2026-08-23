import { pool } from '../db.js'

export async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT id, name, email, password FROM users WHERE email = $1',
    [email],
  )

  return result.rows[0] ?? null
}

export async function createUser({ name, email, password }) {
  const result = await pool.query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
    [name, email, password],
  )

  return result.rows[0]
}

export async function updateUser(id, { email, password, name }) {
  const updates = []
  const values = []

  if (email != null) {
    updates.push(`email = $${updates.length + 1}`)
    values.push(email)
  }

  if (password != null) {
    updates.push(`password = $${updates.length + 1}`)
    values.push(password)
  }

  if (name != null) {
    updates.push(`name = $${updates.length + 1}`)
    values.push(name)
  }

  if (updates.length === 0) return null

  values.push(id)
  const result = await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}
     RETURNING id, name, email`,
    values,
  )

  return result.rows[0] ?? null
}

export async function findAllUsers() {
  const result = await pool.query(`
    SELECT
      u.name,
      u.email,
      COALESCE((
        SELECT SUM(a.value)
        FROM account a
        WHERE a.user_id = u.id AND a.paid = TRUE
      ), 0) AS total_paid,
      COALESCE((
        SELECT SUM(i.value)
        FROM income i
        WHERE i.user_id = u.id
      ), 0) AS total_income
    FROM users u
    ORDER BY u.name
  `)

  return result.rows.map(row => ({
    name: row.name,
    email: row.email,
    totalPaid: Number(row.total_paid) || 0,
    totalIncome: Number(row.total_income) || 0,
  }))
}
