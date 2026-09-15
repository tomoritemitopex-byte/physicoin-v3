import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { mineProof, verifyProof } from "@/lib/proof";

// Round mining: everyone grinds nonstop, ONE winner per round.
// Lowest score wins the round; ties go to the earliest submission.
// Round = 10 minutes. Winner takes ROUND_REWARD coins.

export const ROUND_SECS = 600;
export const ROUND_REWARD = 1;
export const ROUND_DIFFICULTY = 12;
export const ROUND_NONCES = 2000;
// Rounds count from this moment; changing it later starts a new chain.
export const GENESIS_ISO = "2026-09-15T00:00:00Z";

export function roundNumberAt(when: number): number {
  return Math.max(0, Math.floor((when - Date.parse(GENESIS_ISO)) / (ROUND_SECS * 1000)));
}

async function ensureRound(n: number) {
  const sql = getDb();
  const start = new Date(Date.parse(GENESIS_ISO) + n * ROUND_SECS * 1000);
  const end = new Date(start.getTime() + ROUND_SECS * 1000);
  await sql`
    INSERT INTO physi_rounds (number, starts_at, ends_at)
    VALUES (${n}, ${start.toISOString()}, ${end.toISOString()})
    ON CONFLICT (number) DO NOTHING`;
}

export async function closeRound(n: number) {
  const sql = getDb();
  await ensureRound(n);
  const rows = await sql<{ status: string }[]>`
    SELECT status FROM physi_rounds WHERE number = ${n} LIMIT 1`;
  if (!rows[0] || rows[0].status === "closed") return null;
  const best = await sql<{ user_id: string; nonce: string; score: number }[]>`
    SELECT user_id, nonce::text, score FROM physi_round_proofs
    WHERE round_number = ${n} ORDER BY score ASC, submitted_at ASC LIMIT 1`;
  if (!best[0]) {
    await sql`UPDATE physi_rounds SET status = 'closed', closed_at = NOW() WHERE number = ${n}`;
    return { round: n, winner: null as string | null };
  }
  const w = best[0];
  await sql`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + ${ROUND_REWARD}) WHERE id = ${w.user_id}`;
  const grid = await sql<{ grid: Buffer }[]>`
    SELECT grid FROM physi_round_proofs
    WHERE round_number = ${n} AND user_id = ${w.user_id} AND nonce = ${w.nonce} LIMIT 1`;
  await sql`
    INSERT INTO physi_mining_logs (user_id, base_reward, authority_multiplier, earned_amount, proof_nonce, proof_score, proof_grid, round_number)
    VALUES (${w.user_id}, ${ROUND_REWARD}, 1, ${ROUND_REWARD}, ${w.nonce}, ${w.score}, ${grid[0]?.grid || null}, ${n})`;
  const users = await sql<{ rep_ghost_sig: string | null }[]>`
    SELECT rep_ghost_sig FROM physi_users WHERE id = ${w.user_id} LIMIT 1`;
  const prev = users[0]?.rep_ghost_sig || "GENESIS";
  const sig = createHash("sha256").update(`${prev}:${w.user_id}:round-${n}`).digest("hex");
  await sql`INSERT INTO physi_ghost_chain (user_id, prev_sig, new_sig, action)
    VALUES (${w.user_id}, ${prev}, ${sig}, 'round_win')`;
  await sql`UPDATE physi_users SET rep_ghost_sig = ${sig}, ghost_sig_updated_at = NOW() WHERE id = ${w.user_id}`;
  await sql`UPDATE physi_rounds SET status = 'closed', winner_user_id = ${w.user_id},
    winning_score = ${w.score}, winning_nonce = ${w.nonce}, closed_at = NOW() WHERE number = ${n}`;
  return { round: n, winner: w.user_id, score: w.score };
}

/** Close every finished round before doing anything else. */
export async function settle() {
  const now = Date.now();
  const current = roundNumberAt(now);
  const sql = getDb();
  const open = await sql<{ number: number }[]>`
    SELECT number FROM physi_rounds WHERE status = 'open' AND ends_at <= NOW() ORDER BY number ASC LIMIT 20`;
  const closed = [];
  for (const r of open) {
    if (r.number < current) closed.push(await closeRound(r.number));
  }
  // Rounds with proofs but no row yet (old rows predate ensureRound): find via proofs.
  const orphans = await sql<{ n: number }[]>`
    SELECT DISTINCT round_number AS n FROM physi_round_proofs p
    WHERE NOT EXISTS (SELECT 1 FROM physi_rounds r WHERE r.number = p.round_number)`;
  for (const o of orphans) {
    if (o.n < current) {
      await ensureRound(o.n);
      closed.push(await closeRound(o.n));
    }
  }
  return closed;
}

export async function currentRound() {
  await settle();
  const n = roundNumberAt(Date.now());
  await ensureRound(n);
  const sql = getDb();
  const [r] = await sql`SELECT number, starts_at, ends_at, status FROM physi_rounds WHERE number = ${n} LIMIT 1`;
  const lead = await sql<{ user_id: string; score: number }[]>`
    SELECT user_id, score FROM physi_round_proofs
    WHERE round_number = ${n} ORDER BY score ASC, submitted_at ASC LIMIT 1`;
  const endsIn = Math.max(0, Math.round((Date.parse(r.ends_at) - Date.now()) / 1000));
  return {
    round: n,
    ends_in_secs: endsIn,
    reward: ROUND_REWARD,
    leader: lead[0] || null,
    status: r.status,
  };
}

/** Website miners: the server grinds ONE proof for you and submits it. */
export async function grindAndSubmit(user_id: string) {
  const sql = getDb();
  const u = await sql`SELECT id FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  await settle();
  const n = roundNumberAt(Date.now());
  await ensureRound(n);
  const challenge = `v3-round:${n}:${user_id}`;
  const proof = await mineProof(challenge, ROUND_DIFFICULTY, ROUND_NONCES);
  return recordProof(user_id, n, proof.nonce, proof.grid_hex, proof.score);
}

/** Separate machines: submit an externally mined proof (verified here). */
export async function recordProof(
  user_id: string,
  round: number,
  nonce: number,
  grid_hex: string,
  score: number
) {
  const sql = getDb();
  const u = await sql`SELECT id FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  await settle();
  const current = roundNumberAt(Date.now());
  if (round !== current) throw new DomainError("ROUND_CLOSED", "That round already closed.", 409);
  const challenge = `v3-round:${round}:${user_id}`;
  const ok = await verifyProof(challenge, 155, nonce, grid_hex).catch(() => false);
  if (!ok) throw new DomainError("BAD_PROOF", "Proof does not verify.", 422);
  if (score > ROUND_DIFFICULTY) {
    throw new DomainError("TOO_WEAK", `Score ${score} misses the round bar (${ROUND_DIFFICULTY}).`, 422);
  }
  const gridBytes = Buffer.from(grid_hex, "hex");
  try {
    await sql`
      INSERT INTO physi_round_proofs (round_number, user_id, nonce, score, grid)
      VALUES (${round}, ${user_id}, ${nonce}, ${score}, ${gridBytes})`;
  } catch (e) {
    if (String((e as Error)?.message || "").includes("duplicate")) {
      throw new DomainError("DUPLICATE_PROOF", "That proof is already in.", 409);
    }
    throw e;
  }
  return currentRound();
}

export async function roundWins(user_id: string, limit = 20) {
  const sql = getDb();
  return await sql`
    SELECT number AS round, winning_score AS score, reward, closed_at FROM physi_rounds
    WHERE winner_user_id = ${user_id} ORDER BY number DESC LIMIT ${Math.min(limit, 50)}`;
}
