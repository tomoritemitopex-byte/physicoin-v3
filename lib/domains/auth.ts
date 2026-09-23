import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { DomainError } from "./users";

// Token sessions: HMAC-signed, revocable, PASSWORD-gated.
// No open issuance: a wallet without a password must enroll first
// (one open call, then locked forever). No dev fallback — without
// AUTH_SECRET the module throws instead of minting weak tokens.

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new DomainError("AUTH_MISCONFIGURED", "Server auth is not configured.", 503);
  return s;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
}

const b64 = (s: string) =>
  Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();

export async function issueSession(user_id: string, password: string, ttlHours = 24 * 30) {
  if (!password || password.length < 8 || password.length > 128) {
    throw new DomainError("BAD_CREDENTIALS", "Password required.", 401);
  }
  const sql = getDb();
  const u = await sql<{ id: string; password_hash: string | null }[]>`
    SELECT id, password_hash FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  if (!u[0].password_hash) {
    throw new DomainError("NOT_ENROLLED", "Set a password first (one time).", 403);
  }
  const [algo, salt, hash] = String(u[0].password_hash).split("$");
  if (algo !== "scrypt" || !salt || !hash) throw new DomainError("BAD_CREDENTIALS", "Bad credentials.", 401);
  const calc = hashPassword(password, salt);
  const a = Buffer.from(calc);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new DomainError("BAD_CREDENTIALS", "Bad credentials.", 401);
  }
  const exp = Date.now() + ttlHours * 3600 * 1000;
  const body = `${user_id}.${exp}`;
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return { token: `${b64(body)}.${sig}`, user_id, expires_at: new Date(exp).toISOString() };
}

/** One-time password enrollment. Open only while no password exists. */
export async function enroll(user_id: string, password: string) {
  if (!password || password.length < 8 || password.length > 128) {
    throw new DomainError("BAD_PASSWORD", "Password must be 8–128 characters.", 400);
  }
  const sql = getDb();
  const u = await sql<{ password_hash: string | null }[]>`
    SELECT password_hash FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  if (u[0].password_hash) throw new DomainError("LOCKED", "Password already set.", 409);
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  await sql`UPDATE physi_users SET password_hash = ${`scrypt$${salt}$${hash}`} WHERE id = ${user_id}`;
  return issueSession(user_id, password);
}

export async function validateSession(token: string): Promise<{ user_id: string }> {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) throw new DomainError("BAD_TOKEN", "Invalid session.", 401);
  const body = unb64(parts[0]);
  const [user_id, exp] = body.split(".");
  if (!user_id || !exp || Number(exp) < Date.now()) {
    throw new DomainError("BAD_TOKEN", "Session expired or invalid.", 401);
  }
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(parts[1]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new DomainError("BAD_TOKEN", "Invalid session.", 401);
  }
  const sql = getDb();
  const jti = createHmac("sha256", secret()).update(token).digest("hex");
  const revoked = await sql`SELECT jti FROM physi_revoked_tokens WHERE jti = ${jti} LIMIT 1`;
  if (revoked[0]) throw new DomainError("REVOKED", "Session was signed out.", 401);
  const user = await sql`SELECT id FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!user[0]) throw new DomainError("BAD_TOKEN", "Wallet no longer exists.", 401);
  return { user_id };
}

export async function revokeSession(token: string) {
  const sql = getDb();
  const jti = createHmac("sha256", secret()).update(token).digest("hex");
  await sql`
    INSERT INTO physi_revoked_tokens (jti, revoked_at, expires_at)
    VALUES (${jti}, NOW(), NOW() + INTERVAL '30 days')
    ON CONFLICT (jti) DO NOTHING`;
  return { jti };
}
