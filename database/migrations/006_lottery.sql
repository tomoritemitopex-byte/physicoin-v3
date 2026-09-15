-- v3 migration 006: lottery rounds — tickets, versions, chain links.
ALTER TABLE physi_round_proofs ADD COLUMN IF NOT EXISTS ticket_hex TEXT;
ALTER TABLE physi_round_proofs ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE physi_rounds ADD COLUMN IF NOT EXISTS prev_hash TEXT;
ALTER TABLE physi_rounds ADD COLUMN IF NOT EXISTS winning_ticket TEXT;
