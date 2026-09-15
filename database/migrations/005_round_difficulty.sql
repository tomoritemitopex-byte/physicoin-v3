-- v3 migration 005: per-round lattice order + difficulty threshold.
ALTER TABLE physi_rounds ADD COLUMN IF NOT EXISTS lattice_order INT NOT NULL DEFAULT 6;
ALTER TABLE physi_rounds ADD COLUMN IF NOT EXISTS difficulty INT NOT NULL DEFAULT 10;
