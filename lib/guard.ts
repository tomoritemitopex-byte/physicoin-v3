import { validateSession } from "@/lib/domains/auth";
import { DomainError } from "@/lib/domains/users";

// One rule for every mutating route: the session must belong to the
// wallet being acted as. Pass {optional:true} only where the product
// explicitly allows anonymous action (bunk reports, note drops) —
// and even then, a PRESENT id must match the session.

export async function actor(req: Request, body: any, field: string): Promise<string> {
  const h = req.headers.get("authorization") || "";
  const token = body?.token || (h.startsWith("Bearer ") ? h.slice(7) : "");
  if (!token) throw new DomainError("NO_TOKEN", "Wallet session required.", 401);
  const { user_id } = await validateSession(token);
  const claimed = body?.[field];
  if (claimed && claimed !== user_id) {
    throw new DomainError("NOT_YOURS", "This session cannot act as that wallet.", 403);
  }
  return user_id;
}

export async function actorOptional(req: Request, body: any, field: string): Promise<string | null> {
  const h = req.headers.get("authorization") || "";
  const token = body?.token || (h.startsWith("Bearer ") ? h.slice(7) : "");
  if (!token) {
    if (body?.[field]) throw new DomainError("NO_TOKEN", "Wallet session required to act as a named wallet.", 401);
    return null;
  }
  const { user_id } = await validateSession(token);
  const claimed = body?.[field];
  if (claimed && claimed !== user_id) {
    throw new DomainError("NOT_YOURS", "This session cannot act as that wallet.", 403);
  }
  return user_id;
}

/** Proves a live enrolled session without binding to a specific wallet. */
export async function anySession(req: Request): Promise<string> {
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) throw new DomainError("NO_TOKEN", "Wallet session required.", 401);
  const { user_id } = await validateSession(token);
  return user_id;
}

/** Client-borne text, hard-capped (argon2/DB DoS guard). */
export function cap(s: unknown, max: number): string {
  return String(s || "").slice(0, max);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the value is a canonical UUID. */
export function isUuid(v: unknown): boolean {
  return UUID_RE.test(String(v ?? "").trim());
}

/**
 * Query params that land in a UUID column must be UUIDs before they reach SQL.
 * Postgres rejects '' with "invalid input syntax for type uuid", which surfaced
 * as a 500 instead of a 400. Every route that accepts an id validates here.
 */
export function requireUuid(value: unknown, field: string): string {
  const v = String(value ?? "").trim();
  if (!isUuid(v)) throw new DomainError("BAD_INPUT", `${field} must be a UUID.`, 400);
  return v;
}
