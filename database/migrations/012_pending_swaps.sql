-- v3 migration 012: pending venue/period swap hints — honest, not instant.
-- POST /api/schedule queues a hint; closeRound() consumes hints into the next block.
-- Hints never move the timetable directly; only a winning grid that happens
-- to place the rank/reg pair at the hinted slot is considered honored.
CREATE TABLE IF NOT EXISTS physi_pending_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  period TEXT NOT NULL,
  from_venue TEXT,
  from_period TEXT,
  proposer_id UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','consumed','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ,
  consumed_round INT REFERENCES physi_rounds(number) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS physi_pending_swaps_status_idx ON physi_pending_swaps (status);
CREATE INDEX IF NOT EXISTS physi_pending_swaps_created_idx ON physi_pending_swaps (created_at DESC);
CREATE INDEX IF NOT EXISTS physi_pending_swaps_round_idx ON physi_pending_swaps (consumed_round);
CREATE INDEX IF NOT EXISTS physi_pending_swaps_venue_period_idx ON physi_pending_swaps (venue, period);
