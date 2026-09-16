-- v3 migration 011: blocks lock timetable txs (mempool → block).
-- No tables dropped — just the missing link that makes slips become blocks.
ALTER TABLE physi_rounds ADD COLUMN IF NOT EXISTS tx_root TEXT;
ALTER TABLE physi_rounds ADD COLUMN IF NOT EXISTS tx_count INT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS physi_block_txs (
  round_number INT NOT NULL REFERENCES physi_rounds(number) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  PRIMARY KEY (round_number, event_id)
);
CREATE INDEX IF NOT EXISTS physi_block_txs_event_idx ON physi_block_txs (event_id);
