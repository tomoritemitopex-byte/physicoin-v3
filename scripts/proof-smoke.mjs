// Smoke test for the proof bridge: mine easy, verify true, tamper false.
// Usage: node scripts/proof-smoke.mjs  (exit 0 = pass, 1 = fail)
import { mineProof, verifyProof } from "../lib/proof.ts";

const fail = (msg) => {
  console.error(`SMOKE FAIL: ${msg}`);
  process.exit(1);
};

const p = await mineProof("smoke-challenge", 60, 64).catch((e) => fail(`mine threw: ${e.code} ${e.message}`));
console.log(`mined: nonce=${p.nonce} score=${p.score}`);
if (p.score > 60) fail("score beats difficulty");

const ok = await verifyProof("smoke-challenge", 60, p.nonce, p.grid_hex).catch(() => false);
if (!ok) fail("valid proof did not verify");
console.log("verify valid: true");

// Tampered grid must NOT verify.
const tampered = p.grid_hex.slice(0, 2) === "00" ? "01" + p.grid_hex.slice(2) : "00" + p.grid_hex.slice(2);
const okBad = await verifyProof("smoke-challenge", 60, p.nonce, tampered).catch(() => false);
if (okBad) fail("tampered proof verified");
console.log("verify tampered: false");

console.log("SMOKE PASS");
