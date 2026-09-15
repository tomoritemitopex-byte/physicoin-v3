import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb, dbUrl } from "@/lib/db";
import { DomainError } from "./users";

// Token sessions: HMAC-signed, revocable. No passwords in v3 practice
// (password milestone later) — tokens are issued per user id.

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  return `v3-dev-${createHmac("sha256", dbUrl() || "nose").update("auth").digest("hex")}`;
}

const b64 = (s: string) =>
  Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();

export async function issueSession(user_id: string, ttlHours = 24 * 30) {
  const sql = getDb();
  const u = await sql`SELECT id FROM physi_users WHERE id = ${user_id} LIMIT 1`;
  if (!u[0]) throw new DomainError("UNKNOWN_USER", "User not found.", 404);
  const exp = Date.now() + ttlHours * 3600 * 1000;
  const body = `${user_id}.${exp}`;
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return { token: `${b64(body)}.${sig}`, user_id, expires_at: new Date(exp).toISOString() };
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
