import { readFileSync } from "fs";
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
try {
  for (const stmt of stmts) {
    try {
      await sql.unsafe(stmt);
      applied++;
    } catch (e) {
      if (!String(e?.message || e).includes("already exists")) {
        console.error(`[migrate] FAILED: ${stmt.slice(0, 120)}...`);
        console.error(`[migrate] error: ${e?.message || e}`);
        process.exitCode = 1;
        break;
      }
    }
  }
  console.log(`[migrate] done (${applied}/${stmts.length} applied, rest already existed)`);
} finally {
  await sql.end();
}
process.exit(process.exitCode || 0);
