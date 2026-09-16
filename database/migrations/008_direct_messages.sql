-- v3 migration 008: private peer messages. No global feed —
-- a message is readable only by its two wallets (enforced in code
-- via session tokens, not by hiding rows).
CREATE TABLE IF NOT EXISTS physi_direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS physi_dm_pair_idx ON physi_direct_messages (from_user, to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS physi_dm_to_idx ON physi_direct_messages (to_user, created_at DESC);
