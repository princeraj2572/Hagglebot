import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS wants (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  max_price INTEGER NOT NULL CHECK (max_price > 0),
  notes TEXT NOT NULL DEFAULT '',
  buyer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  want_id TEXT NOT NULL REFERENCES wants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  persona TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  want_id TEXT NOT NULL REFERENCES wants(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  status TEXT NOT NULL,
  last_offer INTEGER,
  last_ask INTEGER,
  refusals INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  detail TEXT,
  deal_price INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('buyer','seller')),
  text TEXT NOT NULL,
  price INTEGER,
  at INTEGER NOT NULL,
  guard TEXT
);
CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread_id, id);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL UNIQUE REFERENCES threads(id) ON DELETE CASCADE,
  want_id TEXT NOT NULL REFERENCES wants(id) ON DELETE CASCADE,
  seller_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL,
  paypal_order_id TEXT,
  payer_id TEXT,
  payer_email TEXT,
  capture_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/** Opens (and migrates) a SQLite database. Use ":memory:" in tests. */
export function openDb(path: string): Database.Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  // Databases created before guardrail notes existed need the column added.
  const columns = db.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "guard")) db.exec("ALTER TABLE messages ADD COLUMN guard TEXT");
  return db;
}
