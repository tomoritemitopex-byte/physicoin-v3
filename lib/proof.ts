import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);

// Bridge between the website and the Rust proof engine.
// Rule: NEVER fake a proof. If the binary is missing, slow, or disagrees,
// these functions throw a coded error instead of inventing success.

export type MinedProof = { nonce: number; score: number; grid_hex: string };

export class ProofError extends Error {
  code: "PROOF_BINARY_MISSING" | "PROOF_BUDGET_EXHAUSTED" | "PROOF_FAILED" | "PROOF_BAD_INPUT";
  constructor(code: ProofError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function binPath(): string {
  if (process.env.PROOF_BIN && existsSync(process.env.PROOF_BIN)) return process.env.PROOF_BIN;
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  // engine/physi-proof ships with the app (tracked in git, deployed).
  // proof/target/release/physi-proof is the local dev build.
  for (const p of [resolve(root, "engine/physi-proof"), resolve(root, "proof/target/release/physi-proof")]) {
    if (existsSync(p)) return p;
  }
  throw new ProofError("PROOF_BINARY_MISSING", "proof engine binary not found (engine/physi-proof)");
}

/// Mine a proof: grind until a grid scores at or under maxScore.
/// Throws PROOF_BUDGET_EXHAUSTED when maxNonces run out.
export async function mineProof(
  challenge: string,
  maxScore: number,
  maxNonces: number,
  order = 6,
  timeoutMs = 120_000
): Promise<MinedProof> {
  if (!challenge || maxScore < 0 || maxNonces <= 0) {
    throw new ProofError("PROOF_BAD_INPUT", "challenge, maxScore and maxNonces are required");
  }
  const bin = binPath();
  try {
    const { stdout } = await run(
      bin,
      ["mine", challenge, String(maxScore), String(maxNonces), String(order)],
      { timeout: timeoutMs }
    );
    const p = JSON.parse(stdout.trim()) as MinedProof;
    if (typeof p.nonce !== "number" || typeof p.score !== "number" || typeof p.grid_hex !== "string") {
      throw new ProofError("PROOF_FAILED", "engine returned a malformed proof");
    }
    return p;
  } catch (e) {
    if (e instanceof ProofError) throw e;
    const msg = String((e as Error)?.message || e);
    if (/BUDGET_EXHAUSTED/.test(msg)) throw new ProofError("PROOF_BUDGET_EXHAUSTED", "nonce budget ran out");
    throw new ProofError("PROOF_FAILED", `engine mine failed: ${msg.slice(0, 200)}`);
  }
}

/// Verify a proof: true only if the engine says OK. Anything else throws.
export async function verifyProof(
  challenge: string,
  maxScore: number,
  nonce: number,
  grid_hex: string,
  order = 6,
  timeoutMs = 15_000
): Promise<boolean> {
  if (!challenge || !grid_hex) throw new ProofError("PROOF_BAD_INPUT", "challenge and grid_hex are required");
  const bin = binPath();
  try {
    const { stdout } = await run(
      bin,
      ["verify", challenge, String(maxScore), String(nonce), grid_hex, String(order)],
      { timeout: timeoutMs }
    );
    return stdout.trim() === "OK";
  } catch (e) {
    if (e instanceof ProofError) throw e;
    return false;
  }
}
