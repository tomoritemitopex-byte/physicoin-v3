-- v3 migration 007: truth rewards (proof-of-useful-work) + weekly faucet.
-- Kept in SEPARATE tables from the lottery mint (physi_mining_logs):
-- utility rewards and core mint never mix.
CREATE TABLE IF NOT EXISTS physi_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES physi_events(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('truth_poster','truth_voter','faucet')),
  amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_rewards_user_idx ON physi_rewards (user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS physi_faucet_drips (
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  week TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week)
);
