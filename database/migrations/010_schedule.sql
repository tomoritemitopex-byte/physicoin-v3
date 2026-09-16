-- v3 migration 010: latin-infused timetable — grid IS the schedule.
-- Each round's winning grid becomes the next canonical schedule version,
-- chained by prev ticket (tamper-evident). Slots map row=time × col=hall.

CREATE TABLE IF NOT EXISTS physi_schedule_versions (
  version INT PRIMARY KEY,
  lattice_order INT NOT NULL,
  grid BYTEA NOT NULL,
  score INT NOT NULL,
  ticket_hex TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  winner_user_id UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  round_number INT REFERENCES physi_rounds(number) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_schedule_ver_idx ON physi_schedule_versions (created_at DESC);
