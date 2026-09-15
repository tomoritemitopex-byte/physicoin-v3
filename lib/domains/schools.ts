import { getDb } from "@/lib/db";
import { DomainError } from "./users";

// Schools: students register schools/departments; duplicate names fight
// it out in disputes. Loser is rejected and its coins split:
// 30% destroyed, 5% to the dispute creator, 70% to the winner's creator.

export async function createSchool(input: { name: string; created_by?: string | null }) {
  const name = String(input.name || "").trim();
  if (!name) throw new DomainError("MISSING_FIELDS", "name is required.");
  const sql = getDb();
  try {
    const [s] = await sql`
      INSERT INTO physi_schools (name, created_by) VALUES (${name}, ${input.created_by || null})
      RETURNING id, name, status, event_count, created_at`;
    return s;
  } catch (e) {
    throw e;
  }
}

export async function listSchools(status?: string) {
  const sql = getDb();
  if (status) {
    return await sql`
      SELECT s.id, s.name, s.status, s.event_count,
        (SELECT count(*)::int FROM physi_school_departments d WHERE d.school_id = s.id) AS department_count
      FROM physi_schools s WHERE s.status = ${status} ORDER BY s.created_at DESC LIMIT 100`;
  }
  return await sql`
    SELECT s.id, s.name, s.status, s.event_count,
      (SELECT count(*)::int FROM physi_school_departments d WHERE d.school_id = s.id) AS department_count
    FROM physi_schools s ORDER BY s.created_at DESC LIMIT 100`;
}

export async function reviewSchool(input: { id: string; status: string; reviewer_id: string; rejection_reason?: string }) {
  if (!["verified", "rejected"].includes(input.status)) {
    throw new DomainError("BAD_STATUS", "status must be verified or rejected.");
  }
  const sql = getDb();
  const rows = await sql<{ created_by: string | null }[]>`
    SELECT created_by FROM physi_schools WHERE id = ${input.id} LIMIT 1`;
  if (!rows[0]) throw new DomainError("NOT_FOUND", "School not found.", 404);
  if (rows[0].created_by && rows[0].created_by !== input.reviewer_id) {
    throw new DomainError("FORBIDDEN", "Only the creator can review this school.", 403);
  }
  const [s] = await sql`
    UPDATE physi_schools
    SET status = ${input.status}, verified_by = ${input.reviewer_id}, verified_at = NOW(),
      rejection_reason = ${input.rejection_reason || null}, updated_at = NOW()
    WHERE id = ${input.id}
    RETURNING id, name, status`;
  return s;
}

export async function createDepartment(input: {
  school_id: string;
  name: string;
  years?: number;
  created_by?: string | null;
}) {
  const name = String(input.name || "").trim();
  if (!input.school_id || !name) throw new DomainError("MISSING_FIELDS", "school_id and name are required.");
  const sql = getDb();
  try {
    const [d] = await sql`
      INSERT INTO physi_school_departments (school_id, name, years, created_by)
      VALUES (${input.school_id}, ${name}, ${input.years || 4}, ${input.created_by || null})
      RETURNING id, school_id, name, years, status`;
    return d;
  } catch (e) {
    if (String((e as Error)?.message || "").includes("duplicate")) {
      throw new DomainError("DUPLICATE_DEPT", "That department already exists in this school.", 409);
    }
    throw e;
  }
}

export async function listDepartments(school_id: string) {
  const sql = getDb();
  return await sql`
    SELECT id, school_id, name, years, status, event_count FROM physi_school_departments
    WHERE school_id = ${school_id} ORDER BY name ASC LIMIT 200`;
}

export async function createDispute(input: {
  school_id_a?: string | null;
  school_id_b?: string | null;
  dept_id_a?: string | null;
  dept_id_b?: string | null;
  dispute_type?: string;
  created_by?: string | null;
}) {
  if (!input.school_id_a || !input.school_id_b) {
    throw new DomainError("MISSING_FIELDS", "school_id_a and school_id_b are required.");
  }
  const sql = getDb();
  const [d] = await sql`
    INSERT INTO physi_school_disputes (school_id_a, school_id_b, dept_id_a, dept_id_b, dispute_type)
    VALUES (${input.school_id_a}, ${input.school_id_b}, ${input.dept_id_a || null},
      ${input.dept_id_b || null}, ${input.dispute_type || "school_name"})
    RETURNING id, status, created_at`;
  return d;
}

export async function listDisputes(status?: string) {
  const sql = getDb();
  if (status) {
    return await sql`SELECT * FROM physi_school_disputes WHERE status = ${status} ORDER BY created_at DESC LIMIT 100`;
  }
  return await sql`SELECT * FROM physi_school_disputes ORDER BY created_at DESC LIMIT 100`;
}

export async function resolveDispute(input: {
  id: string;
  outcome: string;
  resolved_by: string;
  resolution_notes?: string;
}) {
  if (!["resolved_a_wins", "resolved_b_wins", "expired", "creator_decided"].includes(input.outcome)) {
    throw new DomainError("BAD_STATUS", "Unknown outcome.");
  }
  const sql = getDb();
  const rows = await sql<{
    id: string; status: string; school_id_a: string; school_id_b: string;
  }[]>`SELECT id, status, school_id_a, school_id_b FROM physi_school_disputes WHERE id = ${input.id} LIMIT 1`;
  if (!rows[0]) throw new DomainError("NOT_FOUND", "Dispute not found.", 404);
  if (rows[0].status !== "active") throw new DomainError("ALREADY_RESOLVED", "Dispute is already resolved.", 409);

  let burned: unknown = null;
  if (input.outcome === "resolved_a_wins" || input.outcome === "resolved_b_wins") {
    const winnerId = input.outcome === "resolved_a_wins" ? rows[0].school_id_a : rows[0].school_id_b;
    const loserId = input.outcome === "resolved_a_wins" ? rows[0].school_id_b : rows[0].school_id_a;
    const schools = await sql<{ id: string; event_count: number; created_by: string | null }[]>`
      SELECT id, event_count, created_by FROM physi_schools WHERE id IN (${winnerId}, ${loserId})`;
    const loser = schools.find((s) => s.id === loserId);
    const winner = schools.find((s) => s.id === winnerId);
    const amount = Number(loser?.event_count || 0);
    const creator_fee = Math.round(amount * 0.05 * 100) / 100;
    const winner_gets = Math.round(amount * 0.7 * 100) / 100;
    const [b] = await sql`
      INSERT INTO physi_coins_burned (dispute_id, loser_school_id, amount_burned, creator_fee, winner_gets, burned_by)
      VALUES (${input.id}, ${loserId}, ${amount}, ${creator_fee}, ${winner_gets}, ${input.resolved_by})
      RETURNING id, amount_burned, creator_fee, winner_gets`;
    burned = b;
    // Loser is rejected as a duplicate; fees credit real wallets (capped).
    await sql`UPDATE physi_schools SET status = 'rejected', rejection_reason = 'duplicate name — lost dispute', updated_at = NOW() WHERE id = ${loserId}`;
    if (creator_fee > 0) {
      await sql`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + ${creator_fee}) WHERE id = ${input.resolved_by}`;
    }
    if (winner_gets > 0 && winner?.created_by) {
      await sql`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + ${winner_gets}) WHERE id = ${winner.created_by}`;
    }
  }
  const [d] = await sql`
    UPDATE physi_school_disputes
    SET status = ${input.outcome}, resolved_at = NOW(), resolved_by = ${input.resolved_by},
      resolution_notes = ${input.resolution_notes || null}
    WHERE id = ${input.id} RETURNING id, status`;
  return { dispute: d, burned };
}
