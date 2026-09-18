import { getDb } from "@/lib/db";
import { DomainError } from "./users";

function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

export type FaucetStatus = {
  votes: number;
  votesNeeded: number;
  hoursLeft: number;
  ageHours: number;
  eligible: boolean;
  drippedThisWeek: boolean;
  week: string;
  dripAmount: number;
  rule: string;
};

export async function getFaucetStatus(userId: string): Promise<FaucetStatus> {
  const sql = getDb();
  const users = await sql<{ id: string; created_at: string }[]>`
    SELECT id, created_at::text AS created_at FROM physi_users WHERE id = ${userId} LIMIT 1`;
  if (!users[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  let votes = 0;
  try {
    const r = await sql<{ c: string }[]>`SELECT count(*)::text AS c FROM physi_verifications WHERE verifier_id = ${userId}`;
    votes = Number(r[0]?.c || 0);
  } catch {
    votes = 0;
  }
  const createdAt = new Date(users[0].created_at);
  const ageHours = Math.max(0, (Date.now() - createdAt.getTime()) / 36e5);
  const hoursLeft = Math.max(0, Math.ceil(24 - ageHours));
  const eligible = votes >= 3 && ageHours >= 24;
  const week = isoWeek();
  let drippedThisWeek = false;
  try {
    const d = await sql`SELECT 1 AS one FROM physi_faucet_drips WHERE user_id = ${userId} AND week = ${week} LIMIT 1`;
    drippedThisWeek = !!(d as any[])[0];
  } catch {
    drippedThisWeek = false;
  }
  return {
    votes,
    votesNeeded: 3,
    hoursLeft,
    ageHours: Math.floor(ageHours),
    eligible,
    drippedThisWeek,
    week,
    dripAmount: 1,
    rule: "3 votes + 24h account age → 1 PHY/week",
  };
}
