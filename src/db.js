import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export const query = async (text, params) => {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
};

export const initDB = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS keys (
      key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      filecode TEXT,
      title TEXT,
      used BOOLEAN DEFAULT FALSE,
      used_by BIGINT,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};

export const loadKeys = async () => {
  const res = await query(`SELECT * FROM keys ORDER BY created_at ASC`);
  const keys = {};
  for (const row of res.rows) {
    keys[row.key] = {
      content: row.content,
      filecode: row.filecode,
      title: row.title,
      used: row.used,
      usedBy: row.used_by,
      usedAt: row.used_at?.toISOString(),
      createdAt: row.created_at?.toISOString(),
    };
  }
  return keys;
};

export const saveKey = async (key, data) => {
  await query(`
    INSERT INTO keys (key, content, filecode, title, used, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (key) DO UPDATE SET
      content = $2, filecode = $3, title = $4, used = $5
  `, [key, data.content, data.filecode, data.title, data.used, data.createdAt]);
};

export const markKeyUsed = async (key, userId) => {
  await query(`
    UPDATE keys SET used = TRUE, used_by = $2, used_at = NOW()
    WHERE key = $1
  `, [key, userId]);
};

export const getKey = async (key) => {
  const res = await query(`SELECT * FROM keys WHERE key = $1`, [key]);
  if (!res.rows[0]) return null;
  const row = res.rows[0];
  return {
    content: row.content,
    filecode: row.filecode,
    title: row.title,
    used: row.used,
    usedBy: row.used_by,
    usedAt: row.used_at?.toISOString(),
    createdAt: row.created_at?.toISOString(),
  };
};

export const getPostedFilecodes = async () => {
  const res = await query(`SELECT filecode FROM keys WHERE filecode IS NOT NULL`);
  return new Set(res.rows.map((r) => r.filecode));
};

export const getKeyStats = async () => {
  const res = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN used = TRUE THEN 1 ELSE 0 END) as used
    FROM keys
  `);
  const { total, used } = res.rows[0];
  return { total: Number(total), used: Number(used), unused: Number(total) - Number(used) };
};

export const getRecentKeys = async (limit = 20) => {
  const res = await query(`SELECT * FROM keys ORDER BY created_at DESC LIMIT $1`, [limit]);
  return res.rows.map((row) => ({
    key: row.key,
    title: row.title,
    used: row.used,
    usedAt: row.used_at?.toISOString(),
  }));
};