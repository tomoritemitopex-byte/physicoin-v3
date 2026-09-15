-- v3 migration 002: wallet-to-wallet transfers ledger.
-- Applied by scripts/migrate.mjs after database/schema.sql, tracked in physi_migrations.
CREATE TABLE IF NOT EXISTS physi_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  memo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_transfers_from_idx ON physi_transfers (from_user, created_at DESC);
CREATE INDEX IF NOT EXISTS physi_transfers_to_idx ON physi_transfers (to_user, created_at DESC);
