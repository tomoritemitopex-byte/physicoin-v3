-- v3 migration 014: Ghost Pods — 24h anonymous verifier squads.
-- When a slip is verified (8-weight quorum), its YES verifiers (up to 7) are
-- auto-invited to an ephemeral pod that expires in 24h. Backend is source of
-- truth; client caches active pods in localStorage (offline-first). Pod that
-- verifies the next slip together gets +0.3 each (rewarded at verification time).
CREATE TABLE IF NOT EXISTS physi_pods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES physi_events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX IF NOT EXISTS physi_pods_event_idx ON physi_pods (event_id);
CREATE INDEX IF NOT EXISTS physi_pods_expires_idx ON physi_pods (expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS physi_pods_event_uidx ON physi_pods (event_id);

CREATE TABLE IF NOT EXISTS physi_pod_members (
  pod_id UUID NOT NULL REFERENCES physi_pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES physi_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pod_id, user_id)
);
CREATE INDEX IF NOT EXISTS physi_pod_members_pod_idx ON physi_pod_members (pod_id);
CREATE INDEX IF NOT EXISTS physi_pod_members_user_idx ON physi_pod_members (user_id);
CREATE INDEX IF NOT EXISTS physi_pod_members_user_pod_idx ON physi_pod_members (user_id, pod_id);
