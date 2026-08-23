import pg from 'pg'
import { env } from './config/env.js'

const { Pool } = pg

export const pool = new Pool({
  ...env.postgres,
})

export async function initializeDatabase() {
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `)

    // ===========================
    // USERS
    // ===========================

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    const userIdTypeResult = await client.query(`
      SELECT format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a
      WHERE a.attrelid = 'users'::regclass
        AND a.attname = 'id'
        AND NOT a.attisdropped
    `)
    const userIdType = userIdTypeResult.rows[0].type

    // ===========================
    // ACCOUNT CATEGORY
    // ===========================

    await client.query(`
      CREATE TABLE IF NOT EXISTS account_category (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        description VARCHAR(100) NOT NULL UNIQUE,

        active BOOLEAN NOT NULL DEFAULT TRUE,

        created_at TIMESTAMP NOT NULL DEFAULT NOW(),

        updated_at TIMESTAMP
      )
    `)

    // ===========================
    // ACCOUNT
    // ===========================

    await client.query(`
      CREATE TABLE IF NOT EXISTS account (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        user_id ${userIdType},

        description VARCHAR(200) NOT NULL,

        category_id UUID NOT NULL,

        value NUMERIC(12,2) NOT NULL,

        due_date DATE NOT NULL,

        payment_date DATE,

        payment_method VARCHAR(20),

        paid BOOLEAN NOT NULL DEFAULT FALSE,

        observations TEXT,

        created_at TIMESTAMP NOT NULL DEFAULT NOW(),

        updated_at TIMESTAMP,

        CONSTRAINT fk_account_category
          FOREIGN KEY (category_id)
          REFERENCES account_category(id)
      )
    `)

    await client.query(`
      ALTER TABLE account
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)
    `)

    const accountUserIdTypeResult = await client.query(`
      SELECT format_type(a.atttypid, a.atttypmod) AS type
      FROM pg_attribute a
      WHERE a.attrelid = 'account'::regclass
        AND a.attname = 'user_id'
        AND NOT a.attisdropped
    `)

    if (accountUserIdTypeResult.rowCount === 0) {
      await client.query(`ALTER TABLE account ADD COLUMN user_id ${userIdType}`)
    } else if (accountUserIdTypeResult.rows[0].type !== userIdType) {
      const nonNullUserIds = await client.query(
        'SELECT 1 FROM account WHERE user_id IS NOT NULL LIMIT 1',
      )

      if (nonNullUserIds.rowCount > 0) {
        throw new Error(
          `Não foi possível migrar account.user_id (${accountUserIdTypeResult.rows[0].type}) para ${userIdType}: existem contas associadas.`,
        )
      }

      await client.query(`
        ALTER TABLE account
        ALTER COLUMN user_id TYPE ${userIdType}
        USING NULL
      `)
    }

    const accountUserForeignKey = await client.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'account'::regclass
        AND conname = 'account_user_id_fkey'
    `)

    if (accountUserForeignKey.rowCount === 0) {
      await client.query(`
        ALTER TABLE account
        ADD CONSTRAINT account_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id)
      `)
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_account_user_id
      ON account(user_id)
    `)

    // ===========================
    // INDEXES
    // ===========================

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_account_due_date
      ON account(due_date)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_account_paid
      ON account(paid)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_account_category
      ON account(category_id)
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS income (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        user_id ${userIdType} NOT NULL REFERENCES users(id),

        description VARCHAR(200) NOT NULL,

        value NUMERIC(12,2) NOT NULL,

        received_date DATE NOT NULL,

        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_income_user_id
      ON income(user_id)
    `)

    // ===========================
    // CATEGORIAS PADRÃO
    // ===========================

    await client.query(`
      INSERT INTO account_category (description)
      VALUES
        ('Moradia'),
        ('Alimentação'),
        ('Transporte'),
        ('Internet'),
        ('Energia'),
        ('Água'),
        ('Telefone'),
        ('Cartão de Crédito'),
        ('Lazer')
      ON CONFLICT (description) DO NOTHING
    `)

  } finally {
    client.release()
  }
}