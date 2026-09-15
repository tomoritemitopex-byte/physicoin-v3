import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { mineProof } from "@/lib/proof";
import { verifyLocal, mineLocal } from "@/lib/proof-engine";
import { buildChallenge, candidateChallenges } from "@/lib/proof-challenge";
import { validateSession } from "./auth";

// Round mining: everyone grinds nonstop, ONE winner per round.
// Lowest score wins the round; ties go to the earliest submission.
// Rounds target ROUND_SECS; a near-flawless proof (score <= 2) closes
// the round immediately. Difficulty retargets every round (mirrors the
// Rust engine's retarget()): fast rounds tighten, slow rounds ease off,
// and a flawless round grows the grid (lattice escalation, max 12).

export const ROUND_SECS = 120;
export const ROUND_REWARD = 1;
export const ROUND_NONCES = 2000;
export const MAX_ROUND_SUBMITS = 25;
export const GENESIS_ORDER = 6;
export const GENESIS_THRESHOLD = 10;
export const MAX_ORDER = 12;
export const CLOSE_EARLY_SCORE = 2;
// Rounds count from this moment; changing it later starts a new chain.
export const GENESIS_ISO = "2026-09-15T00:00:00Z";

export function maxScoreForOrder(n: number): number {
  return 4 * n * (n - 1) + n * n - 1;
}

export function openingThreshold(n: number): number {
  return Math.max(4, Math.round(maxScoreForOrder(n) / 13));
}

export function roundNumberAt(when: number): number {
  return Math.max(0, Math.floor((when - Date.parse(GENESIS_ISO)) / (ROUND_SECS * 1000)));
}

async function latestParams(): Promise<{ order: number; threshold: number }> {
  const sql = getDb();
  const rows = await sql<{ o: number; d: number }[]>`
    SELECT lattice_order AS o, difficulty AS d FROM physi_rounds ORDER BY number DESC LIMIT 1`;
  if (!rows[0]) return { order: GENESIS_ORDER, threshold: GENESIS_THRESHOLD };
  return { order: rows[0].o, threshold: rows[0].d };
}

async function ensureRound(n: number, order?: number, threshold?: number) {
  const sql = getDb();
  const p = order === undefined ? await latestParams() : { order, threshold: threshold as number };
  const start = new Date(Date.parse(GENESIS_ISO) + n * ROUND_SECS * 1000);
  const end = new Date(start.getTime() + ROUND_SECS * 1000);
  await sql`
    INSERT INTO physi_rounds (number, starts_at, ends_at, lattice_order, difficulty)
    VALUES (${n}, ${start.toISOString()}, ${end.toISOString()}, ${p.order}, ${p.threshold})
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
  const info = await sql<{ s: string; o: number; d: number }[]>`
    SELECT starts_at::text AS s, lattice_order AS o, difficulty AS d
    FROM physi_rounds WHERE number = ${n} LIMIT 1`;
  const order = info[0]?.o ?? GENESIS_ORDER;
  const threshold = info[0]?.d ?? GENESIS_THRESHOLD;
  const durationSecs = Math.max(0, Math.round((Date.now() - Date.parse(info[0]?.s || new Date().toISOString())) / 1000));
  // Retarget for the NEXT round (mirrors engine retarget()).
  let nextOrder = order;
  let nextThreshold = threshold;
  if (best[0] && best[0].score === 0) {
    nextOrder = Math.min(order + 1, MAX_ORDER);
    nextThreshold = openingThreshold(nextOrder);
  } else if (durationSecs > (ROUND_SECS * 6) / 5) {
    nextThreshold = Math.min(threshold + 1, maxScoreForOrder(order));
  } else if (durationSecs < (ROUND_SECS * 4) / 5) {
    nextThreshold = Math.max(threshold - 1, 1);
  }
  if (!best[0]) {
    await sql`UPDATE physi_rounds SET status = 'closed', closed_at = NOW() WHERE number = ${n}`;
    await ensureRound(n + 1, nextOrder, nextThreshold);
    return { round: n, winner: null as string | null, next: { order: nextOrder, threshold: nextThreshold } };
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
  await ensureRound(n + 1, nextOrder, nextThreshold);
  return { round: n, winner: w.user_id, score: w.score, next: { order: nextOrder, threshold: nextThreshold } };
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
  const [r] = await sql`SELECT number, starts_at, ends_at, status, lattice_order, difficulty FROM physi_rounds WHERE number = ${n} LIMIT 1`;
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
    lattice_order: r.lattice_order,
    difficulty: r.difficulty,
  };
}

/** Website miners: the server grinds ONE fresh proof for you and submits it.
 * Carries the clicker's session token like any external submit. */
export async function grindAndSubmit(user_id: string, token: string) {
  const sql = getDb();
  const u = await sql`SELECT id FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  await settle();
  const n = roundNumberAt(Date.now());
  await ensureRound(n);
  const [r] = await sql`SELECT lattice_order, difficulty FROM physi_rounds WHERE number = ${n} LIMIT 1`;
  const order = r.lattice_order;
  const threshold = r.difficulty;
  // Random salt per attempt: every grind is new work, never a reprint.
  const salt = randomBytes(8).toString("hex");
  const challenge = buildChallenge({ round: n, userId: user_id, salt });
  // Fast path: Rust binary when it runs here; pure-TS grind otherwise
  // (e.g. serverless hosts where native binaries can't execute).
  let proof: { nonce: number; score: number; grid_hex: string };
  try {
    proof = await mineProof(challenge, threshold, ROUND_NONCES, order);
  } catch {
    const local = mineLocal(challenge, threshold, ROUND_NONCES, order);
    if (!local) throw new DomainError("PROOF_BUDGET_EXHAUSTED", "Nonce budget ran out.", 422);
    proof = local;
  }
  return recordProof(user_id, n, proof.nonce, proof.grid_hex, proof.score, salt, token);
}

/** Separate machines: submit an externally mined proof (verified here).
 * Ownership: the submitter must present the wallet's own live session
 * token — nobody may file proofs (or win rounds) as someone else. */
export async function recordProof(
  user_id: string,
  round: number,
  nonce: number,
  grid_hex: string,
  score: number,
  salt = "",
  token = ""
) {
  const sql = getDb();
  const u = await sql`SELECT id FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  const { user_id: owner } = await validateSession(token);
  if (owner !== user_id) {
    throw new DomainError("NOT_YOUR_WALLET", "This session cannot mine for that wallet.", 403);
  }
  // Anti-spam: each wallet gets limited shots per round. Grind volume
  // still matters, but every submit must count — flooding is pointless.
  const used = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c FROM physi_round_proofs
    WHERE round_number = ${round} AND user_id = ${user_id}`;
  if (used[0].c >= MAX_ROUND_SUBMITS) {
    throw new DomainError("RATE_LIMITED", `Too many submits this round (${MAX_ROUND_SUBMITS} max).`, 429);
  }
  await settle();
  const current = roundNumberAt(Date.now());
  if (round !== current) throw new DomainError("ROUND_CLOSED", "That round already closed.", 409);
  const [r] = await sql`SELECT lattice_order, difficulty FROM physi_rounds WHERE number = ${round} LIMIT 1`;
  const order = r?.lattice_order ?? GENESIS_ORDER;
  const threshold = r?.difficulty ?? GENESIS_THRESHOLD;
  // Nibble form (2*N*N chars, current) or legacy byte-pair (4*N*N).
  if (grid_hex.length !== 2 * order * order && grid_hex.length !== 4 * order * order) {
    throw new DomainError("BAD_PROOF", `Grid is not order ${order}.`, 422);
  }
  // Accept both challenge shapes (see proof-challenge.ts — single spec).
  // Pure-TS verification: no binary needed, identical math.
  let ok = false;
  for (const c of candidateChallenges({ round, userId: user_id, salt })) {
    if (verifyLocal(c, threshold, nonce, grid_hex, order)) {
      ok = true;
      break;
    }
  }
  if (!ok) throw new DomainError("BAD_PROOF", "Proof does not verify.", 422);
  if (score > threshold) {
    throw new DomainError("TOO_WEAK", `Score ${score} misses the round bar (${threshold}).`, 422);
  }
  const gridBytes = Buffer.from(grid_hex, "hex");
  try {
    await sql`
      INSERT INTO physi_round_proofs (round_number, user_id, nonce, score, grid, salt)
      VALUES (${round}, ${user_id}, ${nonce}, ${score}, ${gridBytes}, ${salt})`;
  } catch (e) {
    if (String((e as Error)?.message || "").includes("duplicate")) {
      throw new DomainError("DUPLICATE_PROOF", "That proof is already in.", 409);
    }
    throw e;
  }
  // Near-flawless proof ends the round on the spot — speed escalates.
  if (score <= CLOSE_EARLY_SCORE) {
    await closeRound(round);
  }
  return currentRound();
}

export async function roundWins(user_id: string, limit = 20) {
  const sql = getDb();
  return await sql`
    SELECT number AS round, winning_score AS score, reward, closed_at FROM physi_rounds
    WHERE winner_user_id = ${user_id} ORDER BY number DESC LIMIT ${Math.min(limit, 50)}`;
}

export async function recentRounds(limit = 20) {
  const sql = getDb();
  const rows = await sql<
    { number: number; status: string; winning_score: number | null; reward: string; winner: string | null }[]
  >`
    SELECT r.number, r.status, r.winning_score, r.reward::text, u.nickname AS winner
    FROM physi_rounds r LEFT JOIN physi_users u ON u.id = r.winner_user_id
    ORDER BY r.number DESC LIMIT ${Math.min(limit, 50)}`;
  return rows;
}
