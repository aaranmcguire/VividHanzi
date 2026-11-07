-- D1 storage for the user's synced data: one row per key and user.
-- Apply with: npm run db:migrate
CREATE TABLE IF NOT EXISTS user_state (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
