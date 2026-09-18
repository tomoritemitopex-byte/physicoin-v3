-- v3 migration 013: Timetable Futures — stake 0.5 PHY on whether a slip reaches 8 YES.
-- Winners get 1.2 back when the event is verified; losers lose to voters.
CREATE TABLE IF NOT EXISTS physi_futures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  staker_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('yes','no')),
  stake NUMERIC(14,2) NOT NULL DEFAULT 0.5,
  payout NUMERIC(14,2),
  status TEXT NOT NULL CHECK (status IN ('open','won','lost')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS physi_futures_event_idx ON physi_futures (event_id);
CREATE INDEX IF NOT EXISTS physi_futures_staker_idx ON physi_futures (staker_id);
