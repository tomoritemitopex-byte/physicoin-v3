-- Signed-transaction foundation. Additive only: existing web transfers keep working
-- while clients migrate to cryptographic wallet ownership.

ALTER TABLE physi_users
  ADD COLUMN IF NOT EXISTS wallet_public_key TEXT,
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS wallet_nonce BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS physi_users_wallet_address_uq
  ON physi_users(wallet_address)
  WHERE wallet_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS physi_signed_transactions (
  tx_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  chain_id TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  sender_public_key TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount_minor NUMERIC(78,0) NOT NULL CHECK (amount_minor > 0),
  fee_minor NUMERIC(78,0) NOT NULL CHECK (fee_minor >= 0),
  nonce BIGINT NOT NULL CHECK (nonce >= 0),
  memo TEXT NOT NULL DEFAULT '',
  expires_at BIGINT NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','included','rejected')),
  block_height BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_address, nonce)
);

CREATE INDEX IF NOT EXISTS physi_signed_transactions_status_idx
  ON physi_signed_transactions(status, created_at);
