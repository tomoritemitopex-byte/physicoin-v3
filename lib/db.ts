import postgres from "postgres";

// Single database module for v3. One driver (postgres.js over TCP — works
// against local Postgres AND Neon). No singletons evaluated at import,
// no provider abstraction, and NO DDL functions of any kind: if tables
// are missing, queries fail and routes answer 503. Schema changes happen
// only through scripts/migrate.mjs.

let client: ReturnType<typeof postgres> | null = null;

export function dbUrl(): string | null {
  return process.env.DATABASE_URL || null;
}

export function isDbConfigured(): boolean {
  return !!dbUrl();
}

export function getDb() {
  if (!dbUrl()) throw new Error("DB_NOT_CONFIGURED");
  if (!client) client = postgres(dbUrl()!, { max: 10 });
  return client;
}

export function dbNotConfigured() {
  return {
    ok: false as const,
    code: "DB_NOT_CONFIGURED" as const,
    message: "DATABASE_URL is not set.",
  };
}

export type ApiError = { ok: false; code: string; message: string };
export const err = (code: string, message: string): ApiError => ({ ok: false, code, message });
