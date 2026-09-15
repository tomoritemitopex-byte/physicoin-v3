// Cross-check: TypeScript engine must reproduce Rust output exactly.
// Usage: node scripts/proof-parity.mjs  (needs release binary present)
import { execFileSync } from "node:child_process";
import { derive, scoreGrid, gridToHex, verifyLocal } from "../lib/proof-engine.ts";

const BIN = new URL("../proof/target/release/physi-proof", import.meta.url).pathname;
let fail = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) fail++;
};

const cases = [
  ["parity-1", 0, 6],
  ["parity-1", 7, 6],
  ["v3-round:650:trace", 3, 6],
  ["parity-7", 2, 7],
];

for (const [ch, nonce, order] of cases) {
  // TS derives; Rust CLI judges. Agreement in both directions required.
  const g = derive(ch, nonce, order);
  const hex = gridToHex(g);
  let rustOk = false;
  try {
    execFileSync(BIN, ["verify", ch, "500", String(nonce), hex, String(order)], { stdio: "pipe" });
    rustOk = true;
  } catch {}
  check(`rust accepts ts grid (${ch} #${nonce} o${order}, score ${scoreGrid(g)})`, rustOk);
  check(`ts verifies own grid (${ch} #${nonce})`, verifyLocal(ch, 500, nonce, hex, order));
}

check(
  "uniform 6x6 = 155",
  scoreGrid({ n: 6, rank: Array.from({ length: 6 }, () => Array(6).fill(0)), reg: Array.from({ length: 6 }, () => Array(6).fill(0)) }) === 155
);

// And the reverse: Rust-mined proof must verify in TS.
const out = execFileSync(BIN, ["mine", "parity-x", "12", "200", "6"]).toString().trim();
const p = JSON.parse(out);
check(
  "ts accepts rust proof",
  verifyLocal("parity-x", 12, p.nonce, p.grid_hex, 6) && gridToHex(derive("parity-x", p.nonce, 6)) === p.grid_hex
);

process.exit(fail ? 1 : 0);
