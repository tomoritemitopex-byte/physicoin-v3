-- v3 migration 003: round-based mining. One winner per round.
CREATE TABLE IF NOT EXISTS physi_rounds (
  number INT PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  winner_user_id UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  winning_score INT,
  winning_nonce BIGINT,
  reward NUMERIC(14,2) NOT NULL DEFAULT 1,
  closed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS physi_round_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INT NOT NULL REFERENCES physi_rounds(number) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  nonce BIGINT NOT NULL,
  score INT NOT NULL,
  grid BYTEA NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(round_number, user_id, nonce)
);
CREATE INDEX IF NOT EXISTS physi_round_proofs_round_idx ON physi_round_proofs (round_number, score ASC);
ALTER TABLE physi_mining_logs ADD COLUMN IF NOT EXISTS round_number INT;
