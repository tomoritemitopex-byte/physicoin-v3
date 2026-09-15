import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { voterWeight } from "./votes";

// Peer name resolution: halls, lecturers, scopes.
// Rule everywhere: 8 weight quorum AND 70% agreement -> resolved/merged.

const QUORUM = 8;
const AGREEMENT = 0.7;

function norm(s: string): string {
  return String(s || "").trim().toLowerCase();
}

// ── Halls ──

export async function voteHall(input: {
  alias_name: string;
  canonical_name: string;
  voter_id: string;
  vote: string;
  programme?: string;
  level?: string;
}) {
  const alias = norm(input.alias_name);
  const canonical = norm(input.canonical_name);
  const yes = String(input.vote).toLowerCase() === "yes";
  if (!alias || !canonical || alias === canonical) {
    throw new DomainError("BAD_NAMES", "alias and canonical must differ and be non-empty.");
  }
  const w = await voterWeight(input.voter_id);
  const sql = getDb();
  const [p] = await sql<{ id: string; status: string }[]>`
    INSERT INTO physi_hall_aliases (alias, canonical, programme, level)
    VALUES (${alias}, ${canonical}, ${input.programme || null}, ${input.level || null})
    ON CONFLICT (lower(alias), lower(canonical), COALESCE(hall_group_key, ''))
    DO UPDATE SET alias = EXCLUDED.alias
    RETURNING id, status`;
  await sql`
    INSERT INTO physi_hall_alias_votes (alias_id, voter_id, vote_value)
    VALUES (${p.id}, ${input.voter_id}, ${yes ? 1 : -1})
    ON CONFLICT (alias_id, voter_id) DO UPDATE SET vote_value = EXCLUDED.vote_value`;
  const rows = await sql<{ v: number; wsum: string }[]>`
    SELECT v.vote_value AS v, SUM(u.vote_weight_cached)::text AS wsum
    FROM physi_hall_alias_votes v JOIN physi_users u ON u.id = v.voter_id
    WHERE v.alias_id = ${p.id} GROUP BY v.vote_value`;
  let yw = 0;
  let nw = 0;
  for (const r of rows) {
    if (Number(r.v) === 1) yw = Number(r.wsum);
    else nw = Number(r.wsum);
  }
  // Include this voter's weight if their cached weight wasn't counted (new voter row exists now, so it is counted).
  void w;
  const total = yw + nw;
  let status = p.status;
  if (status === "pending" && yw >= QUORUM && total > 0 && yw / total >= AGREEMENT) {
    await sql`UPDATE physi_hall_aliases SET status = 'resolved', resolved_at = NOW() WHERE id = ${p.id}`;
    status = "resolved";
  }
  return { alias: { id: p.id, alias, canonical, status }, votes: { yes: yw, no: nw } };
}

export async function resolveHall(alias: string) {
  const sql = getDb();
  const rows = await sql<{ canonical: string; status: string }[]>`
    SELECT canonical, status FROM physi_hall_aliases
    WHERE lower(alias) = ${norm(alias)} AND status = 'resolved'
    ORDER BY resolved_at DESC LIMIT 1`;
  if (!rows[0]) return { resolved: false as const };
  return { resolved: true as const, canonical: rows[0].canonical };
}

export async function listHalls(status?: string) {
  const sql = getDb();
  if (status) {
    return await sql`SELECT id, alias, canonical, votes_yes, votes_no, status FROM physi_hall_aliases WHERE status = ${status} ORDER BY created_at DESC LIMIT 100`;
  }
  return await sql`SELECT id, alias, canonical, votes_yes, votes_no, status FROM physi_hall_aliases ORDER BY created_at DESC LIMIT 100`;
}

// ── Lecturers (same pattern, grouped by normalized canonical) ──

export async function voteProf(input: {
  alias_name: string;
  canonical_name: string;
  voter_id: string;
  vote: string;
}) {
  const alias = norm(input.alias_name);
  const canonical = norm(input.canonical_name);
  const yes = String(input.vote).toLowerCase() === "yes";
  if (!alias || !canonical || alias === canonical) {
    throw new DomainError("BAD_NAMES", "alias and canonical must differ and be non-empty.");
  }
  await voterWeight(input.voter_id);
  const sql = getDb();
  // One canonical per group: a second nickname for the same lecturer
  // joins the existing proposal instead of starting a rival one.
  let p: { id: string; status: string } | undefined;
  let joined = false;
  try {
    [p] = await sql<{ id: string; status: string }[]>`
      INSERT INTO physi_prof_aliases (alias, canonical, prof_group_key)
      VALUES (${alias}, ${canonical}, ${canonical})
      ON CONFLICT (lower(alias), lower(canonical), COALESCE(prof_group_key, ''))
      DO UPDATE SET alias = EXCLUDED.alias
      RETURNING id, status`;
  } catch (e) {
    if (!String((e as Error)?.message || "").includes("duplicate")) throw e;
    const rows = await sql<{ id: string; status: string }[]>`
      SELECT id, status FROM physi_prof_aliases
      WHERE prof_group_key = ${canonical} ORDER BY created_at ASC LIMIT 1`;
    if (!rows[0]) throw e;
    p = rows[0];
    joined = true;
  }
  await sql`
    INSERT INTO physi_prof_alias_votes (alias_id, voter_id, vote_value)
    VALUES (${p!.id}, ${input.voter_id}, ${yes ? 1 : -1})
    ON CONFLICT (alias_id, voter_id) DO UPDATE SET vote_value = EXCLUDED.vote_value`;
  const rows = await sql<{ v: number; wsum: string }[]>`
    SELECT v.vote_value AS v, SUM(u.vote_weight_cached)::text AS wsum
    FROM physi_prof_alias_votes v JOIN physi_users u ON u.id = v.voter_id
    WHERE v.alias_id = ${p!.id} GROUP BY v.vote_value`;
  let yw = 0;
  let nw = 0;
  for (const r of rows) {
    if (Number(r.v) === 1) yw = Number(r.wsum);
    else nw = Number(r.wsum);
  }
  const total = yw + nw;
  let status = p!.status;
  if (status === "pending" && yw >= QUORUM && total > 0 && yw / total >= AGREEMENT) {
    await sql`UPDATE physi_prof_aliases SET status = 'resolved', resolved_at = NOW() WHERE id = ${p!.id}`;
    status = "resolved";
  }
  return { alias: { id: p!.id, alias, canonical, status }, votes: { yes: yw, no: nw }, joined };
}

export async function resolveProf(name: string) {
  const sql = getDb();
  const rows = await sql<{ canonical: string }[]>`
    SELECT canonical FROM physi_prof_aliases
    WHERE lower(alias) = ${norm(name)} AND status = 'resolved'
    ORDER BY resolved_at DESC LIMIT 1`;
  if (!rows[0]) return { resolved: false as const };
  return { resolved: true as const, canonical: rows[0].canonical };
}

// ── Scopes: are A and B the same outcome? ──

export async function voteScope(input: {
  scope_a: string;
  scope_b: string;
  voter_id: string;
  vote: string;
}) {
  const a = norm(input.scope_a);
  const b = norm(input.scope_b);
  const yes = String(input.vote).toLowerCase() === "yes";
  if (!a || !b || a === b) {
    throw new DomainError("BAD_SCOPES", "scope_a and scope_b must differ and be non-empty.");
  }
  await voterWeight(input.voter_id);
  const sql = getDb();
  await sql`
    INSERT INTO physi_scope_votes (voter_id, scope_a, scope_b, vote_value)
    VALUES (${input.voter_id}, ${a}, ${b}, ${yes ? 1 : -1})
    ON CONFLICT (voter_id, scope_a, scope_b) DO UPDATE SET vote_value = EXCLUDED.vote_value`;
  const rows = await sql<{ v: number; c: string }[]>`
    SELECT vote_value AS v, count(*)::text AS c FROM physi_scope_votes
    WHERE scope_a = ${a} AND scope_b = ${b} GROUP BY vote_value`;
  let y = 0;
  let n = 0;
  for (const r of rows) {
    if (Number(r.v) === 1) y = Number(r.c);
    else n = Number(r.c);
  }
  const total = y + n;
  let status: "pending" | "merged" | "separate" = "pending";
  let merged_into: string | null = null;
  if (total >= QUORUM && y / total >= AGREEMENT) {
    status = "merged";
    merged_into = a;
  } else if (total >= QUORUM && n / total >= AGREEMENT) {
    status = "separate";
  }
  if (status !== "pending") {
    await sql`
      INSERT INTO physi_scope_resolution (scope_a, scope_b, merged_into, resolution)
      VALUES (${a}, ${b}, ${merged_into}, ${status})
      ON CONFLICT (scope_a, scope_b)
      DO UPDATE SET merged_into = EXCLUDED.merged_into, resolution = EXCLUDED.resolution, resolved_at = NOW()`;
  }
  return { status, merged_into, votes: { yes: y, no: n } };
}

export async function getScopeStatus(a: string, b: string) {
  const sql = getDb();
  const sa = norm(a);
  const sb = norm(b);
  const res = await sql<{ resolution: string; merged_into: string | null }[]>`
    SELECT resolution, merged_into FROM physi_scope_resolution
    WHERE scope_a = ${sa} AND scope_b = ${sb} LIMIT 1`;
  const rows = await sql<{ v: number; c: string }[]>`
    SELECT vote_value AS v, count(*)::text AS c FROM physi_scope_votes
    WHERE scope_a = ${sa} AND scope_b = ${sb} GROUP BY vote_value`;
  let y = 0;
  let n = 0;
  for (const r of rows) {
    if (Number(r.v) === 1) y = Number(r.c);
    else n = Number(r.c);
  }
  return {
    status: res[0]?.resolution || "pending",
    merged_into: res[0]?.merged_into || null,
    votes: { yes: y, no: n },
  };
}
