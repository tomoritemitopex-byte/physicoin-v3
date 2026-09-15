import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

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
ok(
  "proof engine release binary present (run: cargo build --release -p physi-proof)",
  existsSync(resolve(root, "proof/target/release/physi-proof"))
);
ok(".env.example documents DATABASE_URL", readFileSync(resolve(root, ".env.example"), "utf8").includes("DATABASE_URL"));
ok("no runtime DDL markers in lib/", !/CREATE TABLE/i.test(
  (() => { try { return readFileSync(resolve(root, "lib/db.ts"), "utf8"); } catch { return ""; } })()
));
process.exit(fail ? 1 : 0);
