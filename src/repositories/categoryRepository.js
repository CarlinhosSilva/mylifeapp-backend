import { pool } from '../db.js'

export async function findAllCategories() {
  const result = await pool.query(
    'SELECT id, description FROM account_category WHERE active = TRUE ORDER BY description',
  )

  return result.rows
}
