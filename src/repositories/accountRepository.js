import { pool } from '../db.js'

function mapAccount(row) {
  return {
    id: row.id,
    description: row.description,
    categoryId: row.category_id,
    category: row.category_description,
    value: Number(row.value),
    dueDate: row.due_date,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    paid: row.paid,
  }
}

const accountSelect = `
  SELECT
    a.id,
    a.description,
    a.category_id,
    c.description AS category_description,
    a.value,
    TO_CHAR(a.due_date, 'YYYY-MM-DD') AS due_date,
    TO_CHAR(a.payment_date, 'YYYY-MM-DD') AS payment_date,
    a.payment_method,
    a.paid
  FROM account a
  INNER JOIN account_category c ON c.id = a.category_id
`

export async function findAccountsByUser(userId) {
  const result = await pool.query(
    `${accountSelect} WHERE a.user_id = $1 ORDER BY a.due_date`,
    [userId],
  )

  return result.rows.map(mapAccount)
}

export async function createAccount(userId, data) {
  const result = await pool.query(
    `INSERT INTO account
      (user_id, description, category_id, value, due_date, payment_date, paid)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, description, category_id, value,
        TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
        TO_CHAR(payment_date, 'YYYY-MM-DD') AS payment_date,
        payment_method,
        paid`,
    [
      userId,
      data.description,
      data.categoryId,
      data.value,
      data.dueDate,
      data.paymentDate ?? null,
      data.paid ?? false,
    ],
  )

  const account = result.rows[0]
  const categoryResult = await pool.query(
    'SELECT description AS category_description FROM account_category WHERE id = $1',
    [account.category_id],
  )

  return mapAccount({ ...account, category_description: categoryResult.rows[0]?.category_description })
}

export async function updateAccount(id, userId, data) {
  const result = await pool.query(
    `UPDATE account
     SET description = $1, category_id = $2, value = $3, due_date = $4,
         payment_date = $5, paid = $6, updated_at = NOW()
     WHERE id = $7 AND user_id = $8
     RETURNING id, description, category_id, value,
       TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
       TO_CHAR(payment_date, 'YYYY-MM-DD') AS payment_date,
      payment_method,
       paid`,
    [
      data.description,
      data.categoryId,
      data.value,
      data.dueDate,
      data.paymentDate ?? null,
      data.paid,
      id,
      userId,
    ],
  )

  if (result.rowCount === 0) {
    const error = new Error('Conta não encontrada')
    error.statusCode = 404
    throw error
  }

  const account = result.rows[0]
  const categoryResult = await pool.query(
    'SELECT description AS category_description FROM account_category WHERE id = $1',
    [account.category_id],
  )

  return mapAccount({ ...account, category_description: categoryResult.rows[0]?.category_description })
}

export async function deleteAccount(id, userId) {
  const result = await pool.query(
    'DELETE FROM account WHERE id = $1 AND user_id = $2',
    [id, userId],
  )

  if (result.rowCount === 0) {
    const error = new Error('Conta não encontrada')
    error.statusCode = 404
    throw error
  }
}

export async function payAccount(id, userId, { paymentDate, paymentMethod }) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const accountResult = await client.query(
      'SELECT value, paid FROM account WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [id, userId],
    )

    if (accountResult.rowCount === 0) {
      const error = new Error('Conta não encontrada')
      error.statusCode = 404
      throw error
    }

    if (accountResult.rows[0].paid) {
      const error = new Error('Esta conta já foi paga')
      error.statusCode = 400
      throw error
    }

    const balanceResult = await client.query(
      `SELECT
         COALESCE((SELECT SUM(value) FROM income WHERE user_id = $1), 0)
         - COALESCE((SELECT SUM(value) FROM account WHERE user_id = $1 AND paid = TRUE), 0) AS balance`,
      [userId],
    )
    const balance = Number(balanceResult.rows[0].balance)
    const accountValue = Number(accountResult.rows[0].value)

    if (balance < accountValue) {
      const error = new Error('Saldo insuficiente para pagar esta conta')
      error.statusCode = 400
      throw error
    }

    const result = await client.query(
    `UPDATE account
     SET paid = TRUE, payment_date = $1, payment_method = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, description, category_id, value,
       TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
       TO_CHAR(payment_date, 'YYYY-MM-DD') AS payment_date,
       payment_method, paid`,
    [paymentDate, paymentMethod, id, userId],
    )

    const account = result.rows[0]
    const categoryResult = await client.query(
      'SELECT description AS category_description FROM account_category WHERE id = $1',
      [account.category_id],
    )

    await client.query('COMMIT')
    return mapAccount({ ...account, category_description: categoryResult.rows[0]?.category_description })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
