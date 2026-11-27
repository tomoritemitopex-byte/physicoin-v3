-- v3 migration 015: chain-walk index.
-- closeRound() and repairRounds() find the last real winning ticket by
-- walking `number DESC` and stopping at the first non-null. Without a
-- partial index that walk degenerates into a full prefix scan for every
-- row being chained, which turns a backfill into an O(n^2) job.
CREATE INDEX IF NOT EXISTS physi_rounds_ticket_idx
  ON physi_rounds (number DESC) WHERE winning_ticket IS NOT NULL;
