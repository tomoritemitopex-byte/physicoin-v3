-- v3 migration 015: transfer fee column — record gross + burn.
ALTER TABLE physi_transfers ADD COLUMN IF NOT EXISTS fee NUMERIC(14,2) NOT NULL DEFAULT 0;
