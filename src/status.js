// Status/warning system — stored di DB biar persistent

import { query } from "./db.js";

export const initStatusTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS bot_status (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};

export const getStatus = async () => {
  const res = await query(`SELECT value FROM bot_status WHERE key = 'warning'`);
  return res.rows[0]?.value || null;
};

export const setStatus = async (message) => {
  await query(`
    INSERT INTO bot_status (key, value, updated_at)
    VALUES ('warning', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [message]);
};

export const clearStatus = async () => {
  await query(`DELETE FROM bot_status WHERE key = 'warning'`);
};

export const isMaintenance = async () => {
  const res = await query(`SELECT value FROM bot_status WHERE key = 'maintenance'`);
  return res.rows[0]?.value === 'true';
};

export const setMaintenance = async (active) => {
  await query(`
    INSERT INTO bot_status (key, value, updated_at)
    VALUES ('maintenance', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [active ? 'true' : 'false']);
};