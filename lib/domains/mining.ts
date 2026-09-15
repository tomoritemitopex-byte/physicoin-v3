import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { mineProof } from "@/lib/proof";

export const MINING_DIFFICULTY = 10;
export const MINING_NONCES = 2000;
export const MINING_BASE = 1;

/** Daily check-in: grind a fresh puzzle proof, mint coins on it. */
export async function checkIn(user_id: string): Promise<{
  earned: number;
  balance: string;
  proof: { nonce: number; score: number };
}> {
  const sql = getDb();
  const users = await sql<{ id: string; authority_final: string; mining_balance: string; rep_ghost_sig: string | null }[]>`
    SELECT id, authority_final::text, mining_balance::text, rep_ghost_sig FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!users[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);

  const today = new Date().toISOString().slice(0, 10);
  const done = await sql<{ id: string }[]>`
    SELECT id FROM physi_mining_logs
    WHERE user_id = ${user_id} AND created_at::date = ${today}::date LIMIT 1`;
  if (done[0]) {
    throw new DomainError("RATE_LIMITED", "Already checked in today. Come back tomorrow.", 429);
  }

  // Fresh work every day: challenge binds user + date, so proofs can't be reused.
  const challenge = `v3-mine:${user_id}:${today}`;
  const proof = await mineProof(challenge, MINING_DIFFICULTY, MINING_NONCES);
  const gridBytes = Buffer.from(proof.grid_hex, "hex");

  const earned = MINING_BASE * Number(users[0].authority_final || 1);
  const balance = Math.min(10000, Number(users[0].mining_balance) + earned);
  await sql`
    INSERT INTO physi_mining_logs (user_id, base_reward, authority_multiplier, earned_amount, proof_nonce, proof_score, proof_grid)
    VALUES (${user_id}, ${MINING_BASE}, ${Number(users[0].authority_final || 1)}, ${earned},
      ${proof.nonce}, ${proof.score}, ${gridBytes})`;
  await sql`UPDATE physi_users SET mining_balance = ${balance}, updated_at = NOW() WHERE id = ${user_id}`;

  // Ghost chain: link this claim to the user's previous signature.
  const prev = users[0].rep_ghost_sig || "GENESIS";
  const sig = createHash("sha256").update(`${prev}:${user_id}:${today}:${proof.nonce}`).digest("hex");
  await sql`
    INSERT INTO physi_ghost_chain (user_id, prev_sig, new_sig, action)
    VALUES (${user_id}, ${prev}, ${sig}, 'mining_claim')`;
  await sql`UPDATE physi_users SET rep_ghost_sig = ${sig}, ghost_sig_updated_at = NOW() WHERE id = ${user_id}`;

  return { earned, balance: String(balance), proof: { nonce: proof.nonce, score: proof.score } };
}

export async function miningHistory(user_id: string, limit = 10) {
  const sql = getDb();
  return await sql`
    SELECT earned_amount, proof_nonce, proof_score, created_at FROM physi_mining_logs
    WHERE user_id = ${user_id} ORDER BY created_at DESC LIMIT ${Math.min(limit, 50)}`;
}
