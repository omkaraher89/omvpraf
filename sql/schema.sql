-- ChartFlow / TradingView Pro terminal — Cloudflare D1 schema
-- Apply with:  npx wrangler d1 execute chartflow --remote --file=./sql/schema.sql
-- (or --local while developing)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- One workspace snapshot per account: preferences, chart settings, layouts,
-- drawings, drawing templates, alerts and positions.
CREATE TABLE IF NOT EXISTS workspaces (
  client_id     TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  updated_at    INTEGER NOT NULL
);
