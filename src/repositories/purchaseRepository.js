import { pool } from '../db.js'

function mapPurchase(row, items = []) {
  return {
    id: row.id,
    supplierName: row.supplier_name,
    totalValue: Number(row.total_value),
    purchaseDate: row.purchase_date,
    items: items.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity ? Number(item.quantity) : undefined,
      unitPrice: item.unit_price ? Number(item.unit_price) : undefined,
      totalValue: item.total_value ? Number(item.total_value) : undefined,
    })),
    noteText: row.note_text,
    rawText: row.raw_text,
    hasNoteImage: Boolean(row.has_note_image),
  }
}

export async function findPurchasesByUser(userId) {
  const purchasesResult = await pool.query(
    `SELECT id, supplier_name, total_value, TO_CHAR(purchase_date, 'YYYY-MM-DD') AS purchase_date,
            note_text, raw_text, note_image IS NOT NULL AS has_note_image
     FROM purchase
     WHERE user_id = $1
     ORDER BY purchase_date DESC, created_at DESC`,
    [userId],
  )

  const purchaseIds = purchasesResult.rows.map(row => row.id)
  const itemsResult = purchaseIds.length
    ? await pool.query(
        `SELECT id, purchase_id, description, quantity, unit_price, total_value
         FROM purchase_item
         WHERE purchase_id = ANY($1)
         ORDER BY description`,
        [purchaseIds],
      )
    : { rows: [] }

  const itemsByPurchase = itemsResult.rows.reduce((acc, item) => {
    acc[item.purchase_id] ??= []
    acc[item.purchase_id].push(item)
    return acc
  }, {})

  return purchasesResult.rows.map(row => mapPurchase(row, itemsByPurchase[row.id] || []))
}

export async function findPurchaseNoteByUser(purchaseId, userId) {
  const result = await pool.query(
    `SELECT note_image, note_image_mime
     FROM purchase
     WHERE id = $1 AND user_id = $2`,
    [purchaseId, userId],
  )

  return result.rows[0] ?? null
}

export async function createPurchase(userId, data) {
  const { supplierName, totalValue, purchaseDate, items = [], noteText = '', rawText = '', noteImage, noteImageMime } = data

  const result = await pool.query(
    `INSERT INTO purchase (user_id, supplier_name, total_value, purchase_date, note_text, raw_text, note_image, note_image_mime)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, supplier_name, total_value, TO_CHAR(purchase_date, 'YYYY-MM-DD') AS purchase_date,
       note_text, raw_text, note_image IS NOT NULL AS has_note_image`,
    [userId, supplierName, totalValue, purchaseDate, noteText, rawText, noteImage, noteImageMime],
  )

  const purchase = result.rows[0]

  if (items.length) {
    const itemValues = items.map((item, index) => [
      purchase.id,
      item.description,
      item.quantity ?? null,
      item.unitPrice ?? null,
      item.totalValue ?? null,
      index,
    ])

    await pool.query(
      `INSERT INTO purchase_item (purchase_id, description, quantity, unit_price, total_value, position)
       VALUES ${itemValues.map((_, index) => `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`).join(', ')}`,
      itemValues.flat(),
    )
  }

  return mapPurchase(purchase, items.map((item, index) => ({
    id: `${purchase.id}-${index}`,
    description: item.description,
    quantity: item.quantity ?? null,
    unit_price: item.unitPrice ?? null,
    total_value: item.totalValue ?? null,
    purchase_id: purchase.id,
  })))
}

export async function deletePurchase(id, userId) {
  const result = await pool.query(
    'DELETE FROM purchase WHERE id = $1 AND user_id = $2',
    [id, userId],
  )

  if (result.rowCount === 0) {
    const error = new Error('Compra não encontrada')
    error.statusCode = 404
    throw error
  }
}

export async function getPurchaseMonthlySummary(userId) {
  const result = await pool.query(
    `SELECT TO_CHAR(purchase_date, 'YYYY-MM') AS month,
            COUNT(*)::int AS purchases,
            SUM(total_value)::numeric AS total_value
     FROM purchase
     WHERE user_id = $1
     GROUP BY DATE_TRUNC('month', purchase_date)
     ORDER BY DATE_TRUNC('month', purchase_date) DESC`,
    [userId],
  )

  return result.rows.map(row => ({
    month: row.month,
    purchases: Number(row.purchases),
    totalValue: Number(row.total_value || 0),
  }))
}

export async function getPurchaseReport(userId) {
  const [supplierResult, totalResult] = await Promise.all([
    pool.query(
      `SELECT supplier_name, SUM(total_value)::numeric AS total_value
       FROM purchase
       WHERE user_id = $1
       GROUP BY supplier_name
       ORDER BY total_value DESC`,
      [userId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(total_value), 0)::numeric AS total_value
       FROM purchase
       WHERE user_id = $1`,
      [userId],
    ),
  ])

  return {
    totalValue: Number(totalResult.rows[0]?.total_value || 0),
    bySupplier: supplierResult.rows.map(row => ({
      supplierName: row.supplier_name,
      totalValue: Number(row.total_value || 0),
    })),
  }
}
