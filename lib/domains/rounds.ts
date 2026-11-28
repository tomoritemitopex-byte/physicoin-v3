import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { mineLotteryBin } from "@/lib/proof";
import {
  verifyLocal,
  mineLocal,
  gridFromHex,
  scoreGrid,
  derive,
  gridToHex,
  gridHexToBytes,
  ticketHex,
  mineLottery,
  PROOF_VERSION,
} from "@/lib/proof-engine";
import { buildChallenge, candidateChallenges } from "@/lib/proof-challenge";
import { validateSession } from "./auth";

// Round mining: unlimited attempts, ONE lottery winner per round.
// Eligibility (score <= bar) only buys a ticket; the lowest ticket wins.
// Ties go to the earliest submission. Rounds target ROUND_SECS.
// Difficulty retargets every round by volume (mirrors the Rust engine's
// retarget()): busy rounds tighten, empty rounds ease off (capped so
// eligibility always costs real grinding), and a flawless winning score
// grows the grid (lattice escalation, max 12).

export const ROUND_SECS = 120;
export const ROUND_REWARD = 1;
export const ROUND_NONCES = 2000;
export const MAX_ROUND_SUBMITS = 25;
/** Website grind batch: small enough for a snappy click. */
export const WEBSITE_GRIND_NONCES = 64;
/** repairRounds() batch cap: one bounded statement per visit. */
export const REPAIR_BATCH = 5000;
/** Moat rule (Step 6): the bar may never rise above this — eligibility
 * must always cost real grinding (random 6x6 grids score ~60). */
export function barCap(order: number): number {
  return Math.max(8, Math.floor(maxScoreForOrder(order) / 6));
}
export const GENESIS_ORDER = 6;
export const GENESIS_THRESHOLD = 10;
export const MAX_ORDER = 12;
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
  // LOTTERY winner: lowest ticket_hex first (fixed-length hex sorts
  // numerically), earliest submission breaks ties.
  const best = await sql<{ user_id: string; nonce: string; score: number; ticket: string }[]>`
    SELECT user_id, nonce::text, score, ticket_hex AS ticket FROM physi_round_proofs
    WHERE round_number = ${n} AND ticket_hex IS NOT NULL
    ORDER BY ticket_hex ASC, submitted_at ASC LIMIT 1`;
  const info = await sql<{ s: string; o: number; d: number }[]>`
    SELECT starts_at::text AS s, lattice_order AS o, difficulty AS d
    FROM physi_rounds WHERE number = ${n} LIMIT 1`;
  const order = info[0]?.o ?? GENESIS_ORDER;
  const bar = Math.min(info[0]?.d ?? GENESIS_THRESHOLD, barCap(order));
  const durationSecs = Math.max(0, Math.round((Date.now() - Date.parse(info[0]?.s || new Date().toISOString())) / 1000));
  // Retarget: BOTH volume and wall-clock time (mirrors Rust retarget()).
  // Volume: busy rounds tighten, empty ease (lottery luck has no skill curve).
  // Time: fast blocks tighten, slow blocks ease — durationSecs vs ROUND_SECS.
  const subs = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c FROM physi_round_proofs WHERE round_number = ${n}`;
  let nextOrder = order;
  let nextThreshold = bar;
  if (subs[0].c > 40) {
    nextThreshold = Math.max(nextThreshold - 1, 1);
  } else if (subs[0].c === 0) {
    nextThreshold = Math.min(nextThreshold + 1, barCap(order));
  }
  if (durationSecs > ROUND_SECS * 6 / 5) {
    nextThreshold = Math.min(nextThreshold + 1, barCap(order));
  } else if (durationSecs > 0 && durationSecs < ROUND_SECS * 4 / 5) {
    nextThreshold = Math.max(nextThreshold - 1, 1);
  }
  // Lattice escalation under lottery: a flawless (score 0) winner means
  // the order fell — grow the grid (mirrors engine retarget()).
  const winnerScore = best[0]?.score;
  if (best[0] && winnerScore === 0 && order < MAX_ORDER) {
    nextOrder = order + 1;
    nextThreshold = openingThreshold(nextOrder);
  }
  if (!best[0]) {
    // Empty blocks carry the chain: prev_hash stays the last real ticket,
    // which is exactly what verifyChain() expects when several rounds in a
    // row have no submissions.
    const prevRound = await sql<{ t: string | null }[]>`
      SELECT winning_ticket AS t FROM physi_rounds
      WHERE number < ${n} AND winning_ticket IS NOT NULL ORDER BY number DESC LIMIT 1`;
    const prevHash = prevRound[0]?.t || "GENESIS";
    await sql`UPDATE physi_rounds SET status = 'closed', closed_at = NOW(),
      prev_hash = ${prevHash}, tx_root = 'GENESIS', tx_count = 0 WHERE number = ${n}`;
    // Even empty blocks consume pending swap hints — they were included as hints for this block.
    try {
      const pendingSwaps = await sql<{ id: string }[]>`SELECT id FROM physi_pending_swaps WHERE status='pending' ORDER BY created_at ASC LIMIT 12`;
      if (pendingSwaps.length > 0) {
        const ids = pendingSwaps.map((p) => p.id);
        await sql`UPDATE physi_pending_swaps SET status='consumed', consumed_at=NOW(), consumed_round=${n} WHERE id IN (SELECT unnest(${ids}::uuid[]))`;
      }
    } catch {}
    await ensureRound(n + 1, nextOrder, nextThreshold);
    return { round: n, winner: null as string | null, next: { order: nextOrder, threshold: nextThreshold } };
  }
  const w = best[0];
  await sql`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + ${ROUND_REWARD}) WHERE id = ${w.user_id}`;
  // Invite reward: first win pays the inviter 0.5, once ever.
  const inv = await sql<{ by: string | null; paid: boolean }[]>`
    SELECT invited_by AS by, invite_rewarded AS paid FROM physi_users WHERE id = ${w.user_id} LIMIT 1`;
  if (inv[0]?.by && !inv[0].paid) {
    await sql`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + 0.5) WHERE id = ${inv[0].by}`;
    await sql`UPDATE physi_users SET invite_rewarded = true WHERE id = ${w.user_id}`;
  }
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
  // Chain it: this round's header commits to the previous winning ticket.
  const prevRound = await sql<{ t: string | null }[]>`
    SELECT winning_ticket AS t FROM physi_rounds
    WHERE number < ${n} AND winning_ticket IS NOT NULL ORDER BY number DESC LIMIT 1`;
  const prevHash = prevRound[0]?.t || "GENESIS";
  await sql`UPDATE physi_rounds SET status = 'closed', winner_user_id = ${w.user_id},
    winning_score = ${w.score}, winning_nonce = ${w.nonce}, winning_ticket = ${w.ticket},
    prev_hash = ${prevHash}, closed_at = NOW() WHERE number = ${n}`;
  // Mempool → block: lock pending timetable slips into this block.
  // No slips = empty block (still chained, still valid). No destruction.
  let txRoot = "GENESIS";
  let txCount = 0;
  try {
    const pending = await sql<{ id: string }[]>`
      SELECT id FROM physi_events WHERE status = 'pending' ORDER BY created_at ASC LIMIT 12`;
    if (pending.length > 0) {
      txCount = pending.length;
      const ids = pending.map((p) => p.id).sort().join(",");
      txRoot = createHash("sha256").update(ids).digest("hex");
      for (const p of pending) {
        try {
          await sql`INSERT INTO physi_block_txs (round_number, event_id) VALUES (${n}, ${p.id}) ON CONFLICT DO NOTHING`;
        } catch {}
      }
      await sql`UPDATE physi_events SET status = 'verified' WHERE id IN (SELECT unnest(${pending.map((p) => p.id)}::uuid[]))`;
    }
    await sql`UPDATE physi_rounds SET tx_root = ${txRoot}, tx_count = ${txCount} WHERE number = ${n}`;
  } catch {}
  // Latin-infused timetable: winner grid becomes next schedule version.
  try {
    await sql`
      INSERT INTO physi_schedule_versions (version, lattice_order, grid, score, ticket_hex, prev_hash, winner_user_id, round_number)
      VALUES (${n}, ${order}, ${grid[0]?.grid}, ${w.score}, ${w.ticket}, ${prevHash}, ${w.user_id}, ${n})
      ON CONFLICT (version) DO NOTHING`;
  } catch {}
  // Pending swap hints: honest, not instant. Consume them into this block
  // so POST /api/schedule hints are included in the next mined grid's block.
  // They do not move cells directly — they are queued and then marked
  // consumed when the block closes (the grid itself remains the winner's).
  let consumedSwaps = 0;
  let consumedSwapIds: string[] = [];
  try {
    const pendingSwaps = await sql<{ id: string }[]>`SELECT id FROM physi_pending_swaps WHERE status='pending' ORDER BY created_at ASC LIMIT 12`;
    if (pendingSwaps.length > 0) {
      consumedSwaps = pendingSwaps.length;
      consumedSwapIds = pendingSwaps.map((p) => p.id);
      await sql`UPDATE physi_pending_swaps SET status='consumed', consumed_at=NOW(), consumed_round=${n} WHERE id IN (SELECT unnest(${consumedSwapIds}::uuid[]))`;
    }
  } catch {}
  await ensureRound(n + 1, nextOrder, nextThreshold);
  return { round: n, winner: w.user_id, score: w.score, ticket: w.ticket, prev_hash: prevHash, tx_root: txRoot, tx_count: txCount, consumed_swaps: consumedSwaps, consumed_swap_ids: consumedSwapIds, next: { order: nextOrder, threshold: nextThreshold } };
}

/**
 * Make the round table whole.
 *
 * Rounds are created lazily by ensureRound(), so when nobody visits the
 * site the table fills with holes: the tip keeps climbing while whole
 * ranges never get a row, and the rows that do exist stay 'open'.
 * Production showed exactly this - 6 rounds stuck open (49842, 50278,
 * 52386, 52465, 52812, 52814) and ~2,900 missing round numbers.
 *
 * repairRounds() closes anything still open in the past and backfills
 * the holes with empty closed blocks, so the chain reads as one run of
 * 120-second blocks instead of a dotted line. It is idempotent, bounded
 * (a long-idle chain can't blow the request budget), and a no-op when
 * the table is already whole.
 */
export async function repairRounds(batch = REPAIR_BATCH) {
  const current = roundNumberAt(Date.now());
  const sql = getDb();
  const [state] = await sql<{ lo: number | null; hi: number | null; n: number; stale: number }[]>`
    SELECT min(number) AS lo, max(number) AS hi, count(*)::int AS n,
           count(*) FILTER (WHERE status = 'open' AND number < ${current})::int AS stale
    FROM physi_rounds`;
  if (state.hi == null) return { closed: 0, backfilled: 0 };

  // Cheap exit: contiguous, tip is the live round, nothing stale left open.
  const span = state.hi - (state.lo ?? state.hi) + 1;
  if (state.n === span && state.hi >= current && state.stale === 0) {
    return { closed: 0, backfilled: 0 };
  }

  // 1. Close stale rounds that already have a row.
  //    Empty ones can be closed in bulk; a round with submissions must go
  //    through closeRound() so its winning ticket is settled and paid.
  const paid = await sql<{ number: number }[]>`
    SELECT r.number FROM physi_rounds r
    WHERE r.status = 'open' AND r.number < ${current}
      AND EXISTS (SELECT 1 FROM physi_round_proofs p WHERE p.round_number = r.number)
    ORDER BY r.number ASC LIMIT 20`;
  let closed = 0;
  for (const r of paid) {
    await closeRound(r.number);
    closed += 1;
  }
  const bulk = await sql`
    UPDATE physi_rounds r
    SET status = 'closed', closed_at = NOW(),
        prev_hash = COALESCE((SELECT p.winning_ticket FROM physi_rounds p
                              WHERE p.number < r.number AND p.winning_ticket IS NOT NULL
                              ORDER BY p.number DESC LIMIT 1), 'GENESIS'),
        tx_root = 'GENESIS', tx_count = 0
    WHERE r.number IN (
      SELECT number FROM physi_rounds
      WHERE status = 'open' AND number < ${current}
        AND NOT EXISTS (SELECT 1 FROM physi_round_proofs p WHERE p.round_number = physi_rounds.number)
      ORDER BY number ASC LIMIT ${batch})`;
  closed += bulk.count;
  // 2. Round numbers that never got a row at all — gaps left by idle
  //    periods. Fill them as empty closed blocks so the chain is
  //    contiguous, mirroring what closeRound() does for an empty round.
  //    One statement, bounded, oldest-first.
  const stepMs = ROUND_SECS * 1000;
  const genesisMs = Date.parse(GENESIS_ISO);
  const filled = await sql<{ number: number }[]>`
    WITH ordered AS (
      SELECT number, lead(number) OVER (ORDER BY number) AS nxt FROM physi_rounds
    ),
    gaps AS (
      SELECT number + 1 AS s, nxt - 1 AS e
      FROM ordered WHERE nxt IS NOT NULL AND nxt > number + 1
      UNION ALL
      SELECT max(number) + 1, ${current}
      FROM physi_rounds HAVING max(number) < ${current}
    ),
    holes AS (
      SELECT s.g AS n
      FROM gaps CROSS JOIN LATERAL generate_series(gaps.s, gaps.e) AS s(g)
      ORDER BY s.g ASC LIMIT ${batch}
    )
    INSERT INTO physi_rounds
      (number, starts_at, ends_at, lattice_order, difficulty, status, closed_at, prev_hash, tx_root, tx_count)
    SELECT m.n,
           to_timestamp(((${genesisMs}::bigint + m.n * ${stepMs}::bigint))::double precision / 1000.0),
           to_timestamp(((${genesisMs}::bigint + (m.n + 1) * ${stepMs}::bigint))::double precision / 1000.0),
           COALESCE((SELECT r.lattice_order FROM physi_rounds r WHERE r.number < m.n ORDER BY r.number DESC LIMIT 1), ${GENESIS_ORDER}),
           COALESCE((SELECT r.difficulty FROM physi_rounds r WHERE r.number < m.n ORDER BY r.number DESC LIMIT 1), ${GENESIS_THRESHOLD}),
           CASE WHEN m.n < ${current} THEN 'closed' ELSE 'open' END,
           CASE WHEN m.n < ${current} THEN NOW() ELSE NULL END,
           COALESCE((SELECT r.winning_ticket FROM physi_rounds r
                     WHERE r.number < m.n AND r.winning_ticket IS NOT NULL
                     ORDER BY r.number DESC LIMIT 1), 'GENESIS'),
           'GENESIS', 0
    FROM holes m
    ON CONFLICT (number) DO NOTHING
    RETURNING number`;
  return { closed, backfilled: filled.length };
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
  // Holes left by idle periods: backfill and settle past rounds.
  await repairRounds();
  return closed;
}

export async function currentRound() {
  await settle();
  const n = roundNumberAt(Date.now());
  await ensureRound(n);
  const sql = getDb();
  const [r] = await sql`SELECT number, starts_at, ends_at, status, lattice_order, difficulty FROM physi_rounds WHERE number = ${n} LIMIT 1`;
  const lead = await sql<{ user_id: string; score: number; ticket: string }[]>`
    SELECT user_id, score, ticket_hex AS ticket FROM physi_round_proofs
    WHERE round_number = ${n} ORDER BY ticket_hex ASC NULLS LAST, submitted_at ASC LIMIT 1`;
  const endsIn = Math.max(0, Math.round((Date.parse(r.ends_at) - Date.now()) / 1000));
  const prev = await sql<{ t: string | null }[]>`
    SELECT winning_ticket AS t FROM physi_rounds WHERE number < ${n} AND winning_ticket IS NOT NULL ORDER BY number DESC LIMIT 1`;
  return {
    round: n,
    ends_in_secs: endsIn,
    reward: ROUND_REWARD,
    leader: lead[0] || null,
    status: r.status,
    lattice_order: r.lattice_order,
    difficulty: r.difficulty,
    prev_hash: prev[0]?.t || "GENESIS",
    version: PROOF_VERSION,
  };
}

/** Website miners: grind a small batch, submit the best ticket.
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
  const bar = Math.min(r.difficulty, barCap(order));
  const salt = randomBytes(8).toString("hex");
  const challenge = buildChallenge({ round: n, userId: user_id, salt });
  // Best-of-batch lottery ticket. Rust binary when it runs here,
  // pure-TS grind otherwise (serverless hosts can't run binaries).
  let best: { nonce: number; score: number; grid_hex: string; ticket_hex: string } | null = null;
  try {
    const p = await mineLotteryBin(challenge, bar, WEBSITE_GRIND_NONCES, order);
    best = p;
  } catch {
    best = await mineLottery(challenge, bar, WEBSITE_GRIND_NONCES, order);
  }
  if (!best) throw new DomainError("PROOF_BUDGET_EXHAUSTED", "No eligible grid in batch.", 422);
  return recordProof(
    user_id, n, best.nonce, best.grid_hex, best.score, salt, token, best.ticket_hex, PROOF_VERSION
  );
}

/** Separate machines: submit a lottery entry (verified here).
 * Ownership: the submitter must present the wallet's own live session
 * token — nobody may file proofs (or win rounds) as someone else.
 * v1 rules: eligibility (score <= bar) + climb moat (grid must derive
 * from (challenge, nonce) at the fixed budget — Step 6) + ticket match.
 * The server ALWAYS recomputes the ticket; a client-sent ticket that
 * disagrees means a broken client, and is rejected. */
export async function recordProof(
  user_id: string,
  round: number,
  nonce: number,
  grid_hex: string,
  score: number,
  salt = "",
  token = "",
  ticket_hex = "",
  version = PROOF_VERSION
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
  const bar = Math.min(r?.difficulty ?? GENESIS_THRESHOLD, barCap(order));
  if (!/^[\x20-\x7e]{0,64}$/.test(salt)) {
    throw new DomainError("BAD_SALT", "Salt must be printable ASCII, max 64 chars.", 400);
  }
  // Canonical form first: legacy byte-pair grids become nibble grids.
  // Everything downstream (compare, score, store) uses the canonical
  // form, so both formats verify AND store identically (36 bytes at o6).
  const parsed = gridFromHex(grid_hex.toLowerCase(), order);
  if (!parsed) throw new DomainError("BAD_PROOF", `Grid is not order ${order}.`, 422);
  const canon = gridToHex(parsed);
  // v1 verify, both challenge shapes (see proof-challenge.ts — single spec):
  // eligibility on the RECOMPUTED score (claimed score is shown the door),
  // climb moat (grid must derive from its nonce), ticket recompute.
  let ticket: string | null = null;
  const realScore = scoreGrid(parsed);
  if (realScore <= bar) {
    for (const c of candidateChallenges({ round, userId: user_id, salt })) {
      const derived = derive(c, nonce, order);
      if (gridToHex(derived) !== canon) continue;
      ticket = await ticketHex(c, nonce, parsed);
      break;
    }
  }
  if (!ticket) throw new DomainError("BAD_PROOF", "Proof does not verify.", 422);
  if (ticket_hex && ticket_hex.toLowerCase() !== ticket) {
    throw new DomainError("BAD_PROOF", "Ticket does not match recomputation.", 422);
  }
  const gridBytes = Buffer.from(gridHexToBytes(canon, order));
  try {
    await sql`
      INSERT INTO physi_round_proofs (round_number, user_id, nonce, score, grid, salt, ticket_hex, version)
      VALUES (${round}, ${user_id}, ${nonce}, ${realScore}, ${gridBytes}, ${salt}, ${ticket}, ${version})`;
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
    SELECT number AS round, winning_score AS score, winning_ticket AS ticket, reward, closed_at FROM physi_rounds
    WHERE winner_user_id = ${user_id} ORDER BY number DESC LIMIT ${Math.min(limit, 50)}`;
}

export async function miningDashboard(user_id: string, token?: string) {
  if (token) {
    const { user_id: owner } = await validateSession(token);
    if (owner !== user_id) throw new DomainError("NOT_YOUR_WALLET", "This session cannot view that wallet.", 403);
  }
  const sql = getDb();
  const users = await sql<{ mining_balance: string; display_name: string | null }[]>`
    SELECT mining_balance::text, display_name FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!users[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  const receipts = await sql`
    SELECT round_number AS round, earned_amount AS reward, proof_score AS score, proof_nonce AS nonce, created_at
    FROM physi_mining_logs WHERE user_id = ${user_id}
    ORDER BY created_at DESC LIMIT 12`;
  const [stats] = await sql`
    SELECT
      COUNT(*)::int AS accepted_proofs,
      COALESCE(SUM(earned_amount), 0)::text AS total_rewards,
      COALESCE(MIN(proof_score), 0)::int AS best_score
    FROM physi_mining_logs
    WHERE user_id = ${user_id}`;
  const [wins] = await sql`
    SELECT COUNT(*)::int AS rounds_won
    FROM physi_rounds
    WHERE winner_user_id = ${user_id} AND status = 'closed'`;
  // One-glance: your best ticket for the current round (if any)
  let current_ticket: string | null = null;
  let current_round: number | null = null;
  let submits_this_round = 0;
  try {
    const n = roundNumberAt(Date.now());
    current_round = n;
    const t = await sql<{ ticket: string | null }[]>`
      SELECT ticket_hex AS ticket FROM physi_round_proofs
      WHERE round_number = ${n} AND user_id = ${user_id}
      ORDER BY ticket_hex ASC LIMIT 1`;
    current_ticket = t[0]?.ticket || null;
    const c = await sql<{ c: number }[]>`
      SELECT count(*)::int AS c FROM physi_round_proofs WHERE round_number = ${n} AND user_id = ${user_id}`;
    submits_this_round = c[0]?.c ?? 0;
  } catch {}
  return {
    balance: users[0].mining_balance,
    display_name: users[0].display_name,
    receipts,
    current_ticket,
    current_round,
    submits_this_round,
    stats: {
      accepted_proofs: stats?.accepted_proofs ?? 0,
      total_rewards: stats?.total_rewards ?? "0",
      best_score: stats?.best_score ?? 0,
      rounds_won: wins?.rounds_won ?? 0,
    },
  };
}

export async function recentRounds(limit = 20) {
  const sql = getDb();
  const rows = await sql<
    {
      number: number;
      status: string;
      winning_score: number | null;
      reward: string;
      winner: string | null;
      winning_ticket: string | null;
      prev_hash: string | null;
      tx_count: number | null;
      ends_at: string | null;
    }[]
  >`
    SELECT r.number, r.status, r.winning_score, r.reward::text, u.nickname AS winner,
      r.winning_ticket, r.prev_hash, r.tx_count, r.ends_at::text
    FROM physi_rounds r LEFT JOIN physi_users u ON u.id = r.winner_user_id
    ORDER BY r.number DESC LIMIT ${Math.min(limit, 50)}`;
  return rows;
}

/** Blocks that carry a real winning ticket — the student record, not the clock. */
export async function recentWins(limit = 12) {
  const sql = getDb();
  return await sql<
    {
      number: number;
      winning_ticket: string;
      prev_hash: string | null;
      winning_score: number | null;
      reward: string;
      winner: string | null;
      ends_at: string | null;
    }[]
  >`
    SELECT r.number, r.winning_ticket, r.prev_hash, r.winning_score, r.reward::text,
      u.nickname AS winner, r.ends_at::text
    FROM physi_rounds r LEFT JOIN physi_users u ON u.id = r.winner_user_id
    WHERE r.winning_ticket IS NOT NULL
    ORDER BY r.number DESC LIMIT ${Math.min(limit, 50)}`;
}

/** Honest totals for the public chain page. */
export async function chainTotals() {
  const sql = getDb();
  const [r] = await sql<{ sealed: number; with_ticket: number }[]>`
    SELECT count(*)::int AS sealed,
      count(*) FILTER (WHERE winning_ticket IS NOT NULL)::int AS with_ticket
    FROM physi_rounds`;
  return { sealed: Number(r?.sealed ?? 0), with_ticket: Number(r?.with_ticket ?? 0) };
}

export async function leaderboard(limit = 20, includeTest = false) {
  const sql = getDb();
  // Lab vs game: test wallets (test_*) never top a public board.
  // They race and earn like anyone else; they just don't rank.
  const n = Math.min(limit, 50);
  if (includeTest) {
    return await sql`
      SELECT u.nickname, count(*)::int AS wins,
        SUM(r.reward)::text AS earned, MIN(r.winning_score)::int AS best_score
      FROM physi_rounds r JOIN physi_users u ON u.id = r.winner_user_id
      WHERE r.status = 'closed' AND r.winner_user_id IS NOT NULL
      GROUP BY u.nickname ORDER BY wins DESC, earned DESC LIMIT ${n}`;
  }
  return await sql`
    SELECT u.nickname, count(*)::int AS wins,
      SUM(r.reward)::text AS earned, MIN(r.winning_score)::int AS best_score
    FROM physi_rounds r JOIN physi_users u ON u.id = r.winner_user_id
    WHERE r.status = 'closed' AND r.winner_user_id IS NOT NULL
      AND u.nickname NOT LIKE 'test\\_%' ESCAPE '\\'
    GROUP BY u.nickname ORDER BY wins DESC, earned DESC LIMIT ${n}`;
}

// Satoshi Test 2: verify checks prev_hash chain, not one block alone.
// Walks the newest closed blocks in number order, ensuring each prev_hash
// matches the chain's last winning ticket (GENESIS for the first). Empty
// blocks carry the previous ticket forward, so a run of quiet rounds still
// reads as one unbroken chain. Returns first break.
export async function verifyChain(limit = 50): Promise<{ valid: boolean; brokenAt?: number; checked: number }> {
  const sql = getDb();
  const n = Math.min(Math.max(limit, 1), 500);
  const rows = await sql<{ number: number; winning_ticket: string | null; prev_hash: string | null }[]>`
    SELECT number, winning_ticket, prev_hash FROM (
      SELECT number, winning_ticket, prev_hash FROM physi_rounds
      WHERE status = 'closed' ORDER BY number DESC LIMIT ${n}
    ) t ORDER BY number ASC`;
  if (rows.length === 0) return { valid: true, checked: 0 };
  // Anchor on the last real ticket before the window, so a mid-chain check
  // starts from the right value instead of assuming genesis.
  const [anchor] = await sql<{ t: string | null }[]>`
    SELECT winning_ticket AS t FROM physi_rounds
    WHERE number < ${rows[0].number} AND winning_ticket IS NOT NULL
    ORDER BY number DESC LIMIT 1`;
  let expected = anchor?.t || "GENESIS";
  let prev = rows[0].number - 1;
  for (const r of rows) {
    // A deleted block must read as a break, not fade out of the window.
    if (r.number !== prev + 1) return { valid: false, brokenAt: prev + 1, checked: rows.length };
    const got = r.prev_hash || "GENESIS";
    if (got !== expected) return { valid: false, brokenAt: r.number, checked: rows.length };
    if (r.winning_ticket) expected = r.winning_ticket;
    prev = r.number;
  }
  return { valid: true, checked: rows.length };
}
