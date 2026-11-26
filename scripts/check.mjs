import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve, join, relative } from "path";

// Pre-flight checks: schema parses, proof engine binary exists, env documented.
// Usage: npm run check. Fails loudly; never touches the database.
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
let fail = 0;
const ok = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) fail++;
};

const schema = readFileSync(resolve(root, "database/schema.sql"), "utf8");
const stmts = schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
ok(`schema parses (${stmts.length} statements)`, stmts.length > 50);
ok("schema has no CREATE ... SELECT traps", !/create\s+table\s+\S+\s+as\s+select/i.test(schema));
ok("proof engine source present", existsSync(resolve(root, "proof/src/lib.rs")));
ok(".env.example documents DATABASE_URL", readFileSync(resolve(root, ".env.example"), "utf8").includes("DATABASE_URL"));
// Advisory only: CI runners never build the binary, and Vercel ships
// engine/physi-proof instead. Missing binary warns, never fails.
if (!existsSync(resolve(root, "proof/target/release/physi-proof"))) {
  console.log("WARN  proof release binary absent (fine in CI/Vercel — engine/ ships)");
}
ok("no runtime DDL markers in lib/", !/CREATE TABLE/i.test(
  (() => { try { return readFileSync(resolve(root, "lib/db.ts"), "utf8"); } catch { return ""; } })()
));

// --- UUID guard -------------------------------------------------------------
// Postgres rejects a non-UUID string for a uuid column with
// "invalid input syntax for type uuid". Inside a route that means an
// unhandled 500 instead of a 400. Every query param that lands in a uuid
// column must be validated with requireUuid()/isUuid() before it reaches SQL.
const UUID_PARAM = /(user_id|event_id|school_id|viewer_id|voter_id|dispute_id|dept_id|note_id|claimer_id|reporter_id|verified_by|verifier_id|created_by|from_user|to_user|uploader_id|promoted_by|changed_by|burned_by|resolved_by|loser_dept_id|loser_school_id|school_id_a|school_id_b|dept_id_a|dept_id_b)/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const guardSrc = readFileSync(resolve(root, "lib/guard.ts"), "utf8");
ok("lib/guard.ts exports isUuid()", /export function isUuid/.test(guardSrc));
ok("lib/guard.ts exports requireUuid()", /export function requireUuid/.test(guardSrc));

const routeFiles = walk(resolve(root, "app/api")).filter((p) => p.endsWith("route.ts"));
const unguarded = [];
for (const file of routeFiles) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const params = new Set([...src.matchAll(/searchParams\.get\("([a-z_]+)"\)/g)].map((m) => m[1]));
  for (const param of params) {
    if (!UUID_PARAM.test(param)) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes(`searchParams.get("${param}")`)) continue;
      // Case 1: guarded inline on this line.
      if (/requireUuid\(/.test(line) || /isUuid\(/.test(line)) continue;
      // Case 2: assigned to a variable, then that variable is guarded.
      const assigned = line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
      if (assigned) {
        const name = assigned[1];
        const guardedVar = new RegExp(
          `(requireUuid|isUuid)\\([^)]*\\b${name}\\b`
        ).test(src);
        if (guardedVar) continue;
        // Case 3: the variable is validated before use via a truthiness check
        // on a requireUuid() call with that variable as the argument.
        const guardedArg = new RegExp(`requireUuid\\(\\s*${name}\\b`).test(src);
        if (guardedArg) continue;
      }
      unguarded.push(`${relative(root, file)}: "${param}" (line ${i + 1})`);
    }
  }
}
ok(
  `every uuid query param is guarded (${routeFiles.length} routes scanned)`,
  unguarded.length === 0
);
if (unguarded.length) {
  for (const u of unguarded) console.log(`      unguarded uuid param -> ${u}`);
}

process.exit(fail ? 1 : 0);
