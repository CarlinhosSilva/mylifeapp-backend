import { pool } from '../db.js'

function mapIncome(row) {
  return {
    id: row.id,
    description: row.description,
    value: Number(row.value),
    receivedDate: row.received_date,
  }
}

export async function findIncomesByUser(userId) {
  const result = await pool.query(
    `SELECT id, description, value,
       TO_CHAR(received_date, 'YYYY-MM-DD') AS received_date
     FROM income
     WHERE user_id = $1
     ORDER BY received_date DESC, created_at DESC`,
    [userId],
  )

  return result.rows.map(mapIncome)
}

export async function createIncome(userId, { description, value, receivedDate }) {
  const result = await pool.query(
    `INSERT INTO income (user_id, description, value, received_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, description, value,
       TO_CHAR(received_date, 'YYYY-MM-DD') AS received_date`,
    [userId, description, value, receivedDate],
  )

  return mapIncome(result.rows[0])
}

export async function deleteIncome(id, userId) {
  const result = await pool.query(
    'DELETE FROM income WHERE id = $1 AND user_id = $2',
    [id, userId],
  )

  if (result.rowCount === 0) {
    const error = new Error('Receita não encontrada')
    error.statusCode = 404
    throw error
  }
}

export async function getBalanceByUser(userId) {
  const result = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(value) FROM income WHERE user_id = $1), 0) AS incomes,
       COALESCE((SELECT SUM(value) FROM account WHERE user_id = $1 AND paid = TRUE), 0) AS expenses,
       COALESCE((SELECT SUM(total_value) FROM purchase WHERE user_id = $1), 0) AS purchases`,
    [userId],
  )

  const { incomes, expenses, purchases } = result.rows[0]
  const totalExpenses = Number(expenses) + Number(purchases)

  return {
    incomes: Number(incomes),
    expenses: totalExpenses,
    balance: Number(incomes) - totalExpenses,
  }
}

export async function getCurrentMonthSummary(userId) {
  const result = await pool.query(
    `WITH days AS (
       SELECT generate_series(
         date_trunc('month', CURRENT_DATE)::date,
         CURRENT_DATE,
         '1 day'::interval
       )::date AS day
     )
     SELECT
       TO_CHAR(days.day, 'DD') AS day,
       COALESCE((
         SELECT SUM(i.value)
         FROM income i
         WHERE i.user_id = $1 AND i.received_date = days.day
       ), 0) AS incomes,
       COALESCE((
         SELECT SUM(a.value)
         FROM account a
         WHERE a.user_id = $1 AND a.paid = TRUE AND a.payment_date = days.day
       ), 0) AS account_expenses,
       COALESCE((
         SELECT SUM(p.total_value)
         FROM purchase p
         WHERE p.user_id = $1 AND p.purchase_date = days.day
       ), 0) AS purchase_expenses,
       COALESCE((
         SELECT SUM(a.value)
         FROM account a
         WHERE a.user_id = $1 AND COALESCE(a.paid, FALSE) = FALSE AND a.due_date = days.day
       ), 0) AS pending
     FROM days
     ORDER BY days.day`,
    [userId],
  )

  return result.rows.map(row => ({
    day: row.day,
    incomes: Number(row.incomes),
    expenses: Number(row.account_expenses) + Number(row.purchase_expenses),
    pending: Number(row.pending) || 0,
  }))
}

export async function getFamilySummary() {
  const [transactionsResult, balanceResult, monthlyResult, statusResult] = await Promise.all([
    pool.query(`
      SELECT i.id, u.name, i.description, i.value, i.received_date AS date, 'INCOME' AS type, NULL AS payment_method
      FROM income i
      INNER JOIN users u ON u.id = i.user_id
      UNION ALL
      SELECT a.id, u.name, a.description, a.value, a.payment_date AS date, 'PAYMENT' AS type, a.payment_method
      FROM account a
      INNER JOIN users u ON u.id = a.user_id
      WHERE a.paid = TRUE
      UNION ALL
      SELECT a.id, u.name, a.description, a.value, a.due_date AS date, 'ACCOUNT' AS type, NULL AS payment_method
      FROM account a
      INNER JOIN users u ON u.id = a.user_id
      WHERE COALESCE(a.paid, FALSE) = FALSE
      ORDER BY date DESC`),
    pool.query(`
      SELECT
        COALESCE((SELECT SUM(value) FROM income), 0) AS incomes,
        COALESCE((SELECT SUM(value) FROM account WHERE paid = TRUE), 0) AS account_expenses,
        COALESCE((SELECT SUM(total_value) FROM purchase), 0) AS purchase_expenses`),
    pool.query(`
      WITH days AS (
        SELECT generate_series(
          date_trunc('month', CURRENT_DATE)::date,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS day
      )
      SELECT
        TO_CHAR(days.day, 'DD') AS day,
        COALESCE((SELECT SUM(value) FROM income WHERE received_date = days.day), 0) AS incomes,
        COALESCE((SELECT SUM(value) FROM account WHERE paid = TRUE AND payment_date = days.day), 0) AS account_expenses,
        COALESCE((SELECT SUM(total_value) FROM purchase WHERE purchase_date = days.day), 0) AS purchase_expenses,
        COALESCE((SELECT SUM(value) FROM account WHERE COALESCE(paid, FALSE) = FALSE AND due_date = days.day), 0) AS pending
      FROM days
      ORDER BY days.day`),
    pool.query(`
      SELECT COUNT(*)::int AS overdue
      FROM account
      WHERE COALESCE(paid, FALSE) = FALSE AND due_date < CURRENT_DATE`),
  ])

  const { incomes, account_expenses, purchase_expenses } = balanceResult.rows[0]
  const totalExpenses = Number(account_expenses) + Number(purchase_expenses)

  return {
    transactions: transactionsResult.rows.map(row => ({
      id: row.id,
      userName: row.name,
      description: row.description,
      value: Number(row.value),
      date: row.date,
      type: row.type,
      paymentMethod: row.payment_method,
    })),
    incomes: Number(incomes),
    expenses: totalExpenses,
    balance: Number(incomes) - totalExpenses,
    monthlySummary: monthlyResult.rows.map(row => ({
      day: row.day,
      incomes: Number(row.incomes),
      expenses: Number(row.account_expenses) + Number(row.purchase_expenses),
      pending: Number(row.pending) || 0,
    })),
    overdueAccounts: Number(statusResult.rows[0].overdue),
    accountsInDay: Number(statusResult.rows[0].overdue) === 0,
  }
}

export async function getFinancialStatus(userId = null) {
  const result = await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('month', due_date), 'YYYY-MM') AS month,
            COUNT(*)::int AS pending
     FROM account
    WHERE COALESCE(paid, FALSE) = FALSE
       AND ($1::text IS NULL OR user_id::text = $1::text)
     GROUP BY DATE_TRUNC('month', due_date)
     ORDER BY DATE_TRUNC('month', due_date)`,
    [userId == null ? null : String(userId)],
  )

  return {
    isOk: result.rowCount === 0,
    reviewMonths: result.rows.map(row => ({
      month: row.month,
      pending: row.pending,
    })),
  }
}