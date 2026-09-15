-- PhysiCoin v3 — full schema, single source of truth.
-- Fresh database: every table created here, constraints inline.
-- NOTHING in app code may create or alter tables. Ever.
-- Changes go through scripts/migrate.mjs only.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users: profile + rep wallet (authoritative; UI cache lives on-device)
CREATE TABLE IF NOT EXISTS physi_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  nickname TEXT NOT NULL,
  programme TEXT NOT NULL,
  level TEXT NOT NULL,
  statuses JSONB NOT NULL DEFAULT '[]'::jsonb,
  authority_base NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  authority_final NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  mining_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  password_hash TEXT,
  vote_count_total INT NOT NULL DEFAULT 0,
  vote_weight_cached NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  cohort_pattern_cached JSONB,
  cohort_pattern_updated_at TIMESTAMPTZ,
  rep_ghost_sig TEXT,
  ghost_sig_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT physi_users_balance_cap CHECK (mining_balance <= 10000),
  CONSTRAINT physi_users_balance_nonneg CHECK (mining_balance >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS physi_users_nick_uidx ON physi_users (lower(nickname));

-- ── Events: timetable posts / venue-change proposals (pending -> verified)
CREATE TABLE IF NOT EXISTS physi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  scope_type TEXT NOT NULL,
  scope_value TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  authority_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  required_points NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'move' CHECK (severity IN ('move','shift','cancelled')),
  prev_venue TEXT,
  prev_event_time TIME,
  prev_event_date DATE,
  prof_name TEXT,
  is_zk_attested BOOLEAN NOT NULL DEFAULT false,
  slot_key TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_events_dt_idx ON physi_events (event_date DESC, event_time DESC);
CREATE INDEX IF NOT EXISTS physi_events_status_idx ON physi_events (status);
CREATE UNIQUE INDEX IF NOT EXISTS physi_events_tvd_uidx ON physi_events (lower(title), lower(venue), event_date);
CREATE INDEX IF NOT EXISTS physi_events_expires_idx ON physi_events (expires_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS physi_events_prof_idx ON physi_events (lower(prof_name));
CREATE INDEX IF NOT EXISTS physi_events_zk_idx ON physi_events (is_zk_attested);
CREATE INDEX IF NOT EXISTS physi_events_slot_idx ON physi_events (slot_key) WHERE status='pending';

-- ── Verifications: weighted Yes/No/Cancel votes (8-weight consensus)
CREATE TABLE IF NOT EXISTS physi_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('YES','NO','CANCEL')),
  authority_weight NUMERIC(3,2) NOT NULL,
  is_witness BOOLEAN NOT NULL DEFAULT false,
  squad_boost BOOLEAN NOT NULL DEFAULT false,
  award NUMERIC(3,2) NOT NULL DEFAULT 0.3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS physi_verifs_pair_uidx ON physi_verifications (verifier_id, event_id);
CREATE INDEX IF NOT EXISTS physi_verifs_event_idx ON physi_verifications (event_id);
CREATE INDEX IF NOT EXISTS physi_verifs_verifier_idx ON physi_verifications (verifier_id);

-- ── Mining receipts: every coin claim carries its puzzle proof
CREATE TABLE IF NOT EXISTS physi_mining_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  base_reward NUMERIC(14,2) NOT NULL,
  authority_multiplier NUMERIC(3,2) NOT NULL,
  earned_amount NUMERIC(14,2) NOT NULL,
  proof_nonce BIGINT,
  proof_score INT,
  proof_grid BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_mining_user_ts_idx ON physi_mining_logs (user_id, created_at DESC);

-- ── Canonical promotions + daily proof-chain headers
CREATE TABLE IF NOT EXISTS physi_canonical_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  yes_weight NUMERIC(10,2) NOT NULL,
  total_weight NUMERIC(10,2) NOT NULL,
  yes_ratio NUMERIC(5,3) NOT NULL,
  promoted_by UUID REFERENCES physi_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS physi_canonical_event_idx ON physi_canonical_log (event_id);

CREATE TABLE IF NOT EXISTS physi_headers (
  date DATE PRIMARY KEY,
  merkle_root TEXT NOT NULL,
  ghost_tip_root TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hmac TEXT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_headers_created_idx ON physi_headers (created_at DESC);

-- ── Vote bonds: staked rep per verification
CREATE TABLE IF NOT EXISTS physi_vote_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  stake NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL CHECK (status IN ('held','released','burned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(verifier_id, event_id)
);
CREATE INDEX IF NOT EXISTS physi_vote_bonds_event_idx ON physi_vote_bonds (event_id);
CREATE INDEX IF NOT EXISTS physi_vote_bonds_verifier_idx ON physi_vote_bonds (verifier_id);

-- ── Ghost proof chain (SHA256 rep signatures, append-only)
CREATE TABLE IF NOT EXISTS physi_ghost_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  prev_sig TEXT NOT NULL,
  new_sig TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_ghost_chain_user_idx ON physi_ghost_chain (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS physi_ghost_chain_new_sig_idx ON physi_ghost_chain (new_sig);

-- ── Scope merge votes + cached resolutions
CREATE TABLE IF NOT EXISTS physi_scope_votes (
  voter_id UUID REFERENCES physi_users(id) ON DELETE CASCADE,
  scope_a TEXT NOT NULL,
  scope_b TEXT NOT NULL,
  vote_value SMALLINT CHECK (vote_value IN (-1, 1)),
  rep_earned NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (voter_id, scope_a, scope_b)
);
CREATE TABLE IF NOT EXISTS physi_scope_resolution (
  scope_a TEXT,
  scope_b TEXT,
  merged_into TEXT,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution TEXT CHECK (resolution IN ('merged', 'separate')),
  PRIMARY KEY (scope_a, scope_b)
);
CREATE INDEX IF NOT EXISTS physi_scope_votes_voter_idx ON physi_scope_votes (voter_id);
CREATE INDEX IF NOT EXISTS physi_scope_votes_scope_idx ON physi_scope_votes (scope_a, scope_b);
CREATE INDEX IF NOT EXISTS physi_scope_votes_time_idx ON physi_scope_votes (created_at);

-- ── Hall + lecturer alias votes (peer name resolution)
CREATE TABLE IF NOT EXISTS physi_hall_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  canonical TEXT NOT NULL,
  programme TEXT,
  level TEXT,
  subject TEXT,
  hall_group_key TEXT,
  vote_count INT NOT NULL DEFAULT 0,
  votes_yes INT NOT NULL DEFAULT 0,
  votes_no INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','rejected')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_hall_aliases_status_idx ON physi_hall_aliases (status);
CREATE INDEX IF NOT EXISTS physi_hall_aliases_alias_idx ON physi_hall_aliases (lower(alias));
CREATE INDEX IF NOT EXISTS physi_hall_aliases_canonical_idx ON physi_hall_aliases (lower(canonical));
CREATE INDEX IF NOT EXISTS physi_hall_aliases_group_idx ON physi_hall_aliases (hall_group_key);
CREATE UNIQUE INDEX IF NOT EXISTS physi_hall_aliases_pair_uidx ON physi_hall_aliases (lower(alias), lower(canonical), COALESCE(hall_group_key,''));
CREATE TABLE IF NOT EXISTS physi_hall_alias_votes (
  alias_id UUID NOT NULL REFERENCES physi_hall_aliases(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (alias_id, voter_id)
);
CREATE INDEX IF NOT EXISTS physi_hall_alias_votes_voter_idx ON physi_hall_alias_votes (voter_id);

CREATE TABLE IF NOT EXISTS physi_prof_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL,
  canonical TEXT NOT NULL,
  prof_group_key TEXT NOT NULL DEFAULT '',
  programme TEXT,
  level TEXT,
  vote_count INT NOT NULL DEFAULT 0,
  votes_yes INT NOT NULL DEFAULT 0,
  votes_no INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','rejected')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_prof_aliases_status_idx ON physi_prof_aliases (status);
CREATE INDEX IF NOT EXISTS physi_prof_aliases_alias_idx ON physi_prof_aliases (lower(alias));
CREATE INDEX IF NOT EXISTS physi_prof_aliases_canonical_idx ON physi_prof_aliases (lower(canonical));
CREATE INDEX IF NOT EXISTS physi_prof_aliases_group_idx ON physi_prof_aliases (prof_group_key);
CREATE UNIQUE INDEX IF NOT EXISTS physi_prof_aliases_pair_uidx ON physi_prof_aliases (lower(alias), lower(canonical), COALESCE(prof_group_key,''));
CREATE UNIQUE INDEX IF NOT EXISTS physi_prof_aliases_group_canonical_uidx ON physi_prof_aliases (prof_group_key, lower(canonical));
CREATE TABLE IF NOT EXISTS physi_prof_alias_votes (
  alias_id UUID NOT NULL REFERENCES physi_prof_aliases(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (alias_id, voter_id)
);
CREATE INDEX IF NOT EXISTS physi_prof_alias_votes_voter_idx ON physi_prof_alias_votes (voter_id);

-- ── Slot claims (event dedup / competing claims) + edit history
CREATE TABLE IF NOT EXISTS physi_slot_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key TEXT NOT NULL,
  event_id UUID REFERENCES physi_events(id) ON DELETE CASCADE,
  claimer_id UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  venue TEXT NOT NULL,
  event_time TIME NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vote_weight_yes NUMERIC(10,2) NOT NULL DEFAULT 0,
  vote_weight_no NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS physi_slot_claims_slot_idx ON physi_slot_claims (slot_key);
CREATE INDEX IF NOT EXISTS physi_slot_claims_event_idx ON physi_slot_claims (event_id);

CREATE TABLE IF NOT EXISTS physi_event_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  prev_venue TEXT,
  prev_event_date DATE,
  prev_event_time TIME,
  new_venue TEXT NOT NULL,
  new_event_date DATE NOT NULL,
  new_event_time TIME NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES physi_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS physi_event_hist_event_idx ON physi_event_history (event_id, changed_at DESC);

-- ── Schools, departments, disputes, burns, counters
CREATE TABLE IF NOT EXISTS physi_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_by UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  event_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_schools_status_idx ON physi_schools (status);
CREATE INDEX IF NOT EXISTS physi_schools_name_idx ON physi_schools (lower(name));
CREATE INDEX IF NOT EXISTS physi_schools_created_idx ON physi_schools (created_at DESC);
CREATE INDEX IF NOT EXISTS physi_schools_event_count_idx ON physi_schools (event_count DESC);

CREATE TABLE IF NOT EXISTS physi_school_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES physi_schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  years INT NOT NULL DEFAULT 4,
  created_by UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_by UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  event_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_school_depts_school_idx ON physi_school_departments (school_id);
CREATE INDEX IF NOT EXISTS physi_school_depts_name_idx ON physi_school_departments (lower(name));
CREATE INDEX IF NOT EXISTS physi_school_depts_status_idx ON physi_school_departments (status);
CREATE INDEX IF NOT EXISTS physi_school_depts_event_count_idx ON physi_school_departments (event_count DESC);
CREATE UNIQUE INDEX IF NOT EXISTS physi_school_depts_school_name_uidx ON physi_school_departments (school_id, lower(name));

CREATE TABLE IF NOT EXISTS physi_school_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id_a UUID REFERENCES physi_schools(id) ON DELETE CASCADE,
  school_id_b UUID REFERENCES physi_schools(id) ON DELETE CASCADE,
  dept_id_a UUID REFERENCES physi_school_departments(id) ON DELETE CASCADE,
  dept_id_b UUID REFERENCES physi_school_departments(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN ('school_name','department_name','same_school')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved_a_wins','resolved_b_wins','expired','creator_decided')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  resolution_notes TEXT
);
CREATE INDEX IF NOT EXISTS physi_school_disputes_status_idx ON physi_school_disputes (status);
CREATE INDEX IF NOT EXISTS physi_school_disputes_created_idx ON physi_school_disputes (created_at DESC);
CREATE INDEX IF NOT EXISTS physi_school_disputes_school_a_idx ON physi_school_disputes (school_id_a);
CREATE INDEX IF NOT EXISTS physi_school_disputes_school_b_idx ON physi_school_disputes (school_id_b);

CREATE TABLE IF NOT EXISTS physi_coins_burned (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID REFERENCES physi_school_disputes(id) ON DELETE SET NULL,
  loser_school_id UUID REFERENCES physi_schools(id) ON DELETE SET NULL,
  loser_dept_id UUID REFERENCES physi_school_departments(id) ON DELETE SET NULL,
  amount_burned NUMERIC(14,2) NOT NULL,
  creator_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  winner_gets NUMERIC(14,2) NOT NULL DEFAULT 0,
  burned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  burned_by UUID REFERENCES physi_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS physi_coins_burned_dispute_idx ON physi_coins_burned (dispute_id);
CREATE INDEX IF NOT EXISTS physi_coins_burned_school_idx ON physi_coins_burned (loser_school_id);
CREATE INDEX IF NOT EXISTS physi_coins_burned_created_idx ON physi_coins_burned (burned_at DESC);

CREATE TABLE IF NOT EXISTS physi_school_event_counts (
  school_id UUID PRIMARY KEY REFERENCES physi_schools(id) ON DELETE CASCADE,
  dept_id UUID REFERENCES physi_school_departments(id) ON DELETE CASCADE,
  event_count INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Squad pings + waves (12-min / 5-min TTL)
CREATE TABLE IF NOT EXISTS physi_squad_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  programme TEXT NOT NULL DEFAULT 'PHYS',
  level TEXT NOT NULL DEFAULT '100L',
  building_id TEXT NOT NULL DEFAULT 'phys',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '12 minutes'
);
CREATE INDEX IF NOT EXISTS physi_squad_pings_prog_idx ON physi_squad_pings (programme, level);
CREATE INDEX IF NOT EXISTS physi_squad_pings_building_idx ON physi_squad_pings (building_id);
CREATE INDEX IF NOT EXISTS physi_squad_pings_expires_idx ON physi_squad_pings (expires_at);
CREATE INDEX IF NOT EXISTS physi_squad_pings_user_idx ON physi_squad_pings (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS physi_squad_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT 'wave',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);
CREATE INDEX IF NOT EXISTS physi_squad_waves_to_idx ON physi_squad_waves (to_user, expires_at DESC);
CREATE INDEX IF NOT EXISTS physi_squad_waves_from_idx ON physi_squad_waves (from_user);

-- ── Bunk reports (no-show vs happening)
CREATE TABLE IF NOT EXISTS physi_bunk_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  vote TEXT NOT NULL DEFAULT 'no_show' CHECK (vote IN ('no_show','happening')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS physi_bunk_reports_pair_uidx ON physi_bunk_reports (event_id, reporter_id) WHERE reporter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS physi_bunk_reports_event_idx ON physi_bunk_reports (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS physi_bunk_reports_time_idx ON physi_bunk_reports (created_at DESC);

-- ── Notes drops + unlocks
CREATE TABLE IF NOT EXISTS physi_notes_drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  building_id TEXT NOT NULL DEFAULT 'phys',
  level TEXT NOT NULL DEFAULT '100L',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  ocr_text TEXT NOT NULL DEFAULT '',
  image_data TEXT NOT NULL DEFAULT '',
  preview_blur TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS physi_notes_drops_building_idx ON physi_notes_drops (building_id);
CREATE INDEX IF NOT EXISTS physi_notes_drops_level_idx ON physi_notes_drops (level);
CREATE INDEX IF NOT EXISTS physi_notes_drops_created_idx ON physi_notes_drops (created_at DESC);

CREATE TABLE IF NOT EXISTS physi_notes_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES physi_notes_drops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  cost NUMERIC(5,2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(note_id, user_id)
);
CREATE INDEX IF NOT EXISTS physi_notes_unlocks_user_idx ON physi_notes_unlocks (user_id);
CREATE INDEX IF NOT EXISTS physi_notes_unlocks_note_idx ON physi_notes_unlocks (note_id);

-- ── Revoked auth tokens
CREATE TABLE IF NOT EXISTS physi_revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id UUID REFERENCES physi_users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS physi_revoked_tokens_expires_idx ON physi_revoked_tokens (expires_at);
