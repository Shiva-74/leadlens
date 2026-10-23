import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Ensure BIGINT columns (budgets in INR) are parsed as safe JavaScript numbers instead of strings
pg.types.setTypeParser(20, (val: string) => (val === null ? null : parseInt(val, 10)));

if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL is not set in .env. Database operations will fail.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        property_requirement TEXT,
        budget_text TEXT,
        budget_min_inr BIGINT NULL,
        budget_max_inr BIGINT NULL,
        timeline TEXT,
        customer_message TEXT,
        source TEXT NOT NULL CHECK (source IN ('form', 'transcript', 'voice', 'sample')),
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'follow_up', 'won', 'lost')),
        analysis JSONB NULL,
        priority_score INT NULL,
        priority_tag TEXT NULL CHECK (priority_tag IN ('hot', 'warm', 'cold')),
        sub_scores JSONB NULL,
        commitments JSONB NOT NULL DEFAULT '[]'::jsonb,
        follow_up_date TIMESTAMPTZ NULL,
        analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'done', 'failed')),
        analysis_version INT NOT NULL DEFAULT 0,
        provider_used TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY,
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS call_events (
        id UUID PRIMARY KEY,
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('brief', 'debrief')),
        input_mode TEXT NULL CHECK (input_mode IN ('typed', 'voice')),
        input_notes TEXT NULL,
        score_before INT NULL,
        score_after INT NULL,
        output JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ PostgreSQL tables verified/created successfully.');
  } finally {
    client.release();
  }
}

export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}