import { getDb } from "@/lib/db";

// Users domain: profiles + handles. Pure data logic, no HTTP here.
// NOTE: no passwords/sessions yet (auth milestone) — callers pass user ids.

export type User = {
  id: string;
  full_name: string;
  nickname: string;
  programme: string;
  level: string;
  authority_base: string;
  authority_final: string;
  mining_balance: string;
};

export class DomainError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** Handles: lowercase a-z0-9_, must contain '_' and a digit (e.g. alex_02). */
export function validHandle(n: string): boolean {
  return (
    typeof n === "string" &&
    /^[a-z0-9_]+$/.test(n) &&
    n.includes("_") &&
    /\d/.test(n) &&
    n.length <= 32
  );
}

export async function createUser(input: {
  full_name: string;
  nickname: string;
  programme: string;
  level: string;
  invited_by?: string | null;
}): Promise<User> {
  const nickname = String(input.nickname || "").trim().toLowerCase();
  if (!validHandle(nickname)) {
    throw new DomainError("BAD_HANDLE", "Handle must be lowercase a-z0-9_ with '_' and a digit (e.g. alex_02).");
  }
  if (!input.full_name || !input.programme || !input.level) {
    throw new DomainError("MISSING_FIELDS", "full_name, programme and level are required.");
  }
  const sql = getDb();
  if (input.invited_by) {
    const ref = await sql`SELECT id FROM physi_users WHERE id = ${input.invited_by} LIMIT 1`;
    if (!ref[0]) throw new DomainError("BAD_REF", "Inviter not found — joining without referral.", 404);
  }
  try {
    const [u] = await sql<User[]>`
      INSERT INTO physi_users (full_name, nickname, programme, level, invited_by)
      VALUES (${input.full_name}, ${nickname}, ${input.programme}, ${input.level}, ${input.invited_by || null})
      RETURNING id, full_name, nickname, programme, level,
        authority_base, authority_final, mining_balance`;
    return u;
  } catch (e) {
    if (String((e as Error)?.message || "").includes("duplicate")) {
      throw new DomainError("HANDLE_TAKEN", "That handle is taken.", 409);
    }
    throw e;
  }
}

export async function getUser(id: string): Promise<User | null> {
  const sql = getDb();
  const rows = await sql<User[]>`
    SELECT id, full_name, nickname, programme, level,
      authority_base, authority_final, mining_balance
    FROM physi_users WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

export async function getUserByNickname(nickname: string): Promise<User | null> {
  const sql = getDb();
  const rows = await sql<User[]>`
    SELECT id, full_name, nickname, programme, level,
      authority_base, authority_final, mining_balance
    FROM physi_users WHERE lower(nickname) = ${String(nickname).toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

/** Join order: 1 = first wallet ever on this chain. */
export async function walletRank(id: string): Promise<{ rank: number; total: number }> {
  const sql = getDb();
  const rows = await sql<{ rank: string; total: string }[]>`
    SELECT (SELECT count(*)::text FROM physi_users WHERE created_at <= (SELECT created_at FROM physi_users WHERE id = ${id})) AS rank,
      (SELECT count(*)::text FROM physi_users) AS total`;
  return { rank: Number(rows[0]?.rank || 0), total: Number(rows[0]?.total || 0) };
}

export type InviteStats = {
  invite_count: number;
  rewarded_count: number;
  earned: string;
  invites: { id: string; nickname: string; created_at: string; rewarded: boolean }[];
};

/** Invite ledger: how many you brought, how many paid, and 0.5 per first win. */
export async function getInviteStats(userId: string): Promise<InviteStats> {
  const sql = getDb();
  try {
    const [c] = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM physi_users WHERE invited_by = ${userId}`;
    const [r] = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM physi_users WHERE invited_by = ${userId} AND invite_rewarded = true`;
    const invite_count = Number(c?.c || 0);
    const rewarded_count = Number(r?.c || 0);
    const earned = (rewarded_count * 0.5).toFixed(2);
    let invites: InviteStats["invites"] = [];
    try {
      const rows = await sql<{ id: string; nickname: string; created_at: string; rewarded: boolean }[]>`
        SELECT id, nickname, created_at::text, invite_rewarded AS rewarded
        FROM physi_users WHERE invited_by = ${userId}
        ORDER BY created_at DESC LIMIT 12`;
      invites = rows.map((x) => ({ id: x.id, nickname: x.nickname, created_at: String(x.created_at).slice(0, 10), rewarded: !!x.rewarded }));
    } catch {
      invites = [];
    }
    return { invite_count, rewarded_count, earned, invites };
  } catch {
    // Columns missing on stale DB (migration 009 not yet applied) — gracefully degrade.
    return { invite_count: 0, rewarded_count: 0, earned: "0.00", invites: [] };
  }
}
