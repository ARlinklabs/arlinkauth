CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  -- Common fields
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  -- GitHub OAuth fields (optional)
  github_id INTEGER UNIQUE,
  github_username TEXT,
  github_access_token TEXT,
  -- Google OAuth fields (optional)
  google_id TEXT UNIQUE,
  google_access_token TEXT,
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ensure at least one provider is linked
-- (enforced at application level, not DB level for flexibility)

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  encrypted_jwk TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
