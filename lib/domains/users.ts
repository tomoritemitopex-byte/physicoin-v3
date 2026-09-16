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
