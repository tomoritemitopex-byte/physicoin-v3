import { getDb } from "@/lib/db";
import { DomainError } from "./users";

export type Tally = {
  yes: number;
  no: number;
  required: number;
  promoted: boolean;
};

export async function voterWeight(voter_id: string): Promise<number> {
  const sql = getDb();
  const rows = await sql<{ w: string }[]>`
    SELECT COALESCE(vote_weight_cached, authority_final, 1)::text AS w
    FROM physi_users WHERE id = ${voter_id} LIMIT 1`;
  if (!rows[0]) throw new DomainError("UNKNOWN_VOTER", "Voter not found.", 404);
  return Number(rows[0].w) || 1;
}

/** Cast (or change) a weighted Yes/No/Cancel vote. Promotes on quorum. */
export async function castVote(input: {
  verifier_id: string;
  event_id: string;
  vote: string;
}): Promise<{ tally: Tally }> {
  const vote = String(input.vote || "").toUpperCase();
  if (!["YES", "NO", "CANCEL"].includes(vote)) {
    throw new DomainError("BAD_VOTE", "vote must be YES, NO or CANCEL.");
  }
  const sql = getDb();
  const voters = await sql<{ id: string; w: string }[]>`
    SELECT id, COALESCE(vote_weight_cached, authority_final, 1)::text AS w
    FROM physi_users WHERE id = ${input.verifier_id} LIMIT 1`;
  if (!voters[0]) throw new DomainError("UNKNOWN_VOTER", "Voter not found.", 404);
  const events = await sql<{ id: string; status: string; required_points: string }[]>`
    SELECT id, status, required_points::text FROM physi_events WHERE id = ${input.event_id} LIMIT 1`;
  if (!events[0]) throw new DomainError("UNKNOWN_EVENT", "Event not found.", 404);

  const weight = Number(voters[0].w) || 1;
  await sql`
    INSERT INTO physi_verifications (verifier_id, event_id, vote, authority_weight)
    VALUES (${input.verifier_id}, ${input.event_id}, ${vote}, ${weight})
    ON CONFLICT (verifier_id, event_id)
    DO UPDATE SET vote = EXCLUDED.vote, authority_weight = EXCLUDED.authority_weight`;

  const rows = await sql<{ vote: string; w: string }[]>`
    SELECT vote, SUM(authority_weight)::text AS w FROM physi_verifications
    WHERE event_id = ${input.event_id} GROUP BY vote`;
  let yes = 0;
  let no = 0;
  for (const r of rows) {
    if (r.vote === "YES") yes = Number(r.w);
    if (r.vote === "NO") no = Number(r.w);
  }
  const required = Number(events[0].required_points) || 8;
  let promoted = false;
  if (yes >= required && events[0].status !== "verified") {
    await sql`UPDATE physi_events SET status = 'verified', updated_at = NOW() WHERE id = ${input.event_id}`;
    const total = yes + no;
    await sql`
      INSERT INTO physi_canonical_log (event_id, yes_weight, total_weight, yes_ratio, promoted_by)
      VALUES (${input.event_id}, ${yes}, ${total}, ${total ? yes / total : 0}, ${input.verifier_id})`;
    promoted = true;
    // Timetable Futures: settle open stakes when quorum is reached (additive, no drops)
    try {
      const { settle } = await import("@/lib/domains/futures");
      await settle(input.event_id);
    } catch {}
  }
  return { tally: { yes, no, required, promoted } };
}

export async function getTally(event_id: string): Promise<Tally & { status: string }> {
  const sql = getDb();
  const events = await sql<{ status: string; required_points: string }[]>`
    SELECT status, required_points::text FROM physi_events WHERE id = ${event_id} LIMIT 1`;
  if (!events[0]) throw new DomainError("UNKNOWN_EVENT", "Event not found.", 404);
  const rows = await sql<{ vote: string; w: string }[]>`
    SELECT vote, SUM(authority_weight)::text AS w FROM physi_verifications
    WHERE event_id = ${event_id} GROUP BY vote`;
  let yes = 0;
  let no = 0;
  for (const r of rows) {
    if (r.vote === "YES") yes = Number(r.w);
    if (r.vote === "NO") no = Number(r.w);
  }
  return { yes, no, required: Number(events[0].required_points) || 8, promoted: false, status: events[0].status };
}
