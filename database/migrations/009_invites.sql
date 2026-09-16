-- v3 migration 009: invite tracking + reward flag.
ALTER TABLE physi_users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES physi_users(id) ON DELETE SET NULL;
ALTER TABLE physi_users ADD COLUMN IF NOT EXISTS invite_rewarded BOOLEAN NOT NULL DEFAULT false;
