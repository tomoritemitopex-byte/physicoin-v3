-- v3 migration 004: per-attempt salt so every grind is fresh work.
ALTER TABLE physi_round_proofs ADD COLUMN IF NOT EXISTS salt TEXT NOT NULL DEFAULT '';
ALTER TABLE physi_round_proofs DROP CONSTRAINT IF EXISTS physi_round_proofs_round_number_user_id_nonce_key;
CREATE UNIQUE INDEX IF NOT EXISTS physi_round_proofs_dedupe_uidx ON physi_round_proofs (round_number, user_id, nonce, salt);
DROP INDEX IF EXISTS physi_round_proofs_round_idx;
CREATE INDEX IF NOT EXISTS physi_round_proofs_round_idx ON physi_round_proofs (round_number, score ASC);
