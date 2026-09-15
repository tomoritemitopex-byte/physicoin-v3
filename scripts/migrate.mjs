import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;

if (!url) {
  console.warn("[migrate] DATABASE_URL unset — skipping (ok for builds without DB)");
  process.exit(0);
}

// 1. Validate: every statement must start with a known DDL keyword.
//    A bad split or stray text fails the BUILD here, never production.
const schema = readFileSync(resolve(__dirname, "../database/schema.sql"), "utf8");
const stmts = schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
const bad = stmts.filter((s) => {
  const code = s.replace(/^--[^\n]*\n/gm, "").trim();
  return !/^(CREATE|ALTER|DROP|GRANT|COMMENT|SELECT|SET|CREATE EXTENSION)/i.test(code);
});
if (bad.length > 0) {
  console.error(`[migrate] REFUSING: ${bad.length} statement(s) failed validation:`);
  for (const b of bad.slice(0, 3)) console.error("  --- " + b.slice(0, 120));
  process.exit(1);
}

// 2. Apply sequentially. Fail FAST on the first real error so a half-built
//    schema can never deploy silently. "already exists" is tolerated because
//    every statement is IF NOT EXISTS (re-runs are safe).
console.log(`[migrate] applying ${stmts.length} validated statements`);
const sql = postgres(url, { max: 1 });
let applied = 0;
let code = 0;
async function applyOne(stmt, label) {
  try {
    await sql.unsafe(stmt);
    applied++;
  } catch (e) {
    if (!String(e?.message || e).includes("already exists")) {
      console.error(`[migrate] FAILED (${label}): ${stmt.slice(0, 120)}...`);
      console.error(`[migrate] error: ${e?.message || e}`);
      code = 1;
      return false;
    }
  }
  return true;
}
try {
  for (const stmt of stmts) {
    if (!(await applyOne(stmt, "schema.sql"))) break;
  }
  // 3. Append-only migrations: database/migrations/*.sql in order,
  //    each applied once (tracked in physi_migrations).
  if (code === 0) {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS physi_migrations (
      name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const dir = resolve(__dirname, "../database/migrations");
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    } catch {}
    for (const f of files) {
      const done = await sql`SELECT name FROM physi_migrations WHERE name = ${f} LIMIT 1`;
      if (done[0]) {
        console.log(`[migrate] skip ${f} (already applied)`);
        continue;
      }
      console.log(`[migrate] applying migration ${f}`);
      const body = readFileSync(resolve(dir, f), "utf8");
      const parts = body.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
      let okAll = true;
      for (const stmt of parts) {
        if (!(await applyOne(stmt, f))) {
          okAll = false;
          break;
        }
      }
      if (!okAll) {
        code = 1;
        break;
      }
      await sql`INSERT INTO physi_migrations (name) VALUES (${f})`;
    }
  }
  console.log(code === 0 ? `[migrate] done (${applied} statements applied)` : "[migrate] aborted with errors");
} finally {
  await sql.end();
}
process.exit(code);
