import { createHash } from "node:crypto";
import { argon2id } from "hash-wasm";

// Pure-TypeScript twin of the Rust proof engine (proof/src/lib.rs).
// Bit-for-bit compatible by construction: same SHA-256, same SplitMix64,
// same shuffle/climb sequence. The server uses THIS (no binary needed);
// the Rust binary stays the fast path for dedicated miners.
// Any divergence is a bug — cross-checked by scripts/proof-parity.mjs.

const MASK32 = 0xffffffff;

function sha256hex(input: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(input).digest());
}

class SplitMix64 {
  private s: bigint;
  constructor(seed: bigint) {
    this.s = seed & 0xffffffffffffffffn;
  }
  next(): bigint {
    this.s = (this.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return z ^ (z >> 31n);
  }
  below(n: number): number {
    return Number(this.next() % BigInt(n));
  }
}

function seedPrg(challenge: Uint8Array, nonce: bigint): SplitMix64 {
  const nb = new Uint8Array(8);
  const dv = new DataView(nb.buffer);
  dv.setBigUint64(0, nonce, true);
  const input = new Uint8Array(challenge.length + 8);
  input.set(challenge, 0);
  input.set(nb, challenge.length);
  const d = sha256hex(input);
  let seed = 0n;
  for (let i = 0; i < 8; i++) seed |= BigInt(d[i]) << BigInt(8 * i);
  return new SplitMix64(seed);
}

export type Grid = { n: number; rank: number[][]; reg: number[][] };

function shuffledRow(prg: SplitMix64, n: number): number[] {
  const row = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i >= 1; i--) {
    const j = prg.below(i + 1);
    [row[i], row[j]] = [row[j], row[i]];
  }
  return row;
}

function lineConflicts(vals: number[]): number {
  let mask = 0;
  for (const v of vals) mask |= 1 << v;
  let bits = 0;
  for (let m = mask; m; m >>>= 1) bits += m & 1;
  return vals.length - bits;
}

export function scoreGrid(g: Grid): number {
  const n = g.n;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const rr: number[] = [];
    const rg: number[] = [];
    const cr: number[] = [];
    const cg: number[] = [];
    for (let j = 0; j < n; j++) {
      rr.push(g.rank[i][j]);
      rg.push(g.reg[i][j]);
      cr.push(g.rank[j][i]);
      cg.push(g.reg[j][i]);
    }
    total += lineConflicts(rr) + lineConflicts(rg) + lineConflicts(cr) + lineConflicts(cg);
  }
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) seen.add(g.rank[i][j] * n + g.reg[i][j]);
  }
  return total + (n * n - seen.size);
}

export const CLIMB_ITERS = 1500;
export const PROOF_VERSION = 1;
/** Argon2id cost (practice grade — must match Rust TICKET_* consts). */
export const TICKET_MEM_KIB = 8192;
export const TICKET_PASSES = 1;

export function derive(challenge: string, nonce: number, n: number): Grid {
  const enc = new TextEncoder().encode(challenge);
  const prg = seedPrg(enc, BigInt(nonce));
  const rank: number[][] = [];
  const reg: number[][] = [];
  for (let i = 0; i < n; i++) {
    rank.push(shuffledRow(prg, n));
    reg.push(shuffledRow(prg, n));
  }
  const g: Grid = { n, rank, reg };
  let best = scoreGrid(g);
  for (let k = 0; k < CLIMB_ITERS; k++) {
    const tweakRanks = prg.below(2) === 0;
    const a = prg.below(n);
    const b = prg.below(n);
    const c = prg.below(n);
    const d = prg.below(n);
    if (a === c && b === d) continue;
    const m = tweakRanks ? rank : reg;
    const tmp = m[a][b];
    m[a][b] = m[c][d];
    m[c][d] = tmp;
    const s = scoreGrid(g);
    if (s <= best) {
      best = s;
    } else {
      const t2 = m[a][b];
      m[a][b] = m[c][d];
      m[c][d] = t2;
    }
  }
  return g;
}

export function gridToHex(g: Grid): string {  let s = "";
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) s += g.rank[i][j].toString(16);
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) s += g.reg[i][j].toString(16);
  return s;
}

export function gridFromHex(hex: string, n: number): Grid | null {
  const h = hex.toLowerCase();
  // Nibble form: 1 char per cell (current standard).
  // Byte-pair form: 2 chars per cell (first release binaries) — accepted, same values.
  let cells: number[] | null = null;
  if (h.length === 2 * n * n) {
    cells = [...h].map((c) => parseInt(c, 16));
  } else if (h.length === 4 * n * n) {
    cells = [];
    for (let i = 0; i < h.length; i += 2) cells.push(parseInt(h.slice(i, i + 2), 16));
  } else {
    return null;
  }
  if (cells.some((v) => !(v >= 0 && v < n))) return null;
  const rank: number[][] = [];
  const reg: number[][] = [];
  for (let i = 0; i < n; i++) {
    rank.push(cells.slice(i * n, i * n + n));
    reg.push(cells.slice(n * n + i * n, n * n + i * n + n));
  }
  return { n, rank, reg };
}

/** Verify without any binary: re-derive, compare, check the bar. */
export function verifyLocal(
  challenge: string,
  maxScore: number,
  nonce: number,
  gridHex: string,
  order: number
): boolean {
  const g = gridFromHex(gridHex.toLowerCase(), order);
  if (!g) return false;
  if (scoreGrid(g) > maxScore) return false;
  const derived = derive(challenge, nonce, order);
  return gridToHex(derived) === gridHex.toLowerCase();
}

/** Slow-path grind (no binary): same lowest-nonce result as the engine. */
export function mineLocal(
  challenge: string,
  maxScore: number,
  maxNonces: number,
  order: number
): { nonce: number; score: number; grid_hex: string } | null {
  for (let nonce = 0; nonce < maxNonces; nonce++) {
    const g = derive(challenge, nonce, order);
    const s = scoreGrid(g);
    if (s <= maxScore) return { nonce, score: s, grid_hex: gridToHex(g) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lottery (v1): eligibility + lowest ticket wins. Ticket = Argon2id over
// challenge || nonce || grid — identical to Rust ticket().
// ---------------------------------------------------------------------------

function ticketSalt(challenge: string): Uint8Array {
  const h = createHash("sha256").update("PHYSI-LOTTERY-V1" + challenge).digest();
  return new Uint8Array(h.subarray(0, 16));
}

function gridBytes(g: Grid): Uint8Array {
  const out = new Uint8Array(2 * g.n * g.n);
  let k = 0;
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) out[k++] = g.rank[i][j];
  for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) out[k++] = g.reg[i][j];
  return out;
}

export async function ticketHex(challenge: string, nonce: number, g: Grid): Promise<string> {
  const nb = new Uint8Array(8);
  new DataView(nb.buffer).setBigUint64(0, BigInt(nonce), true);
  const gb = gridBytes(g);
  const pw = new Uint8Array(challenge.length + 8 + gb.length);
  pw.set(new TextEncoder().encode(challenge), 0);
  pw.set(nb, challenge.length);
  pw.set(gb, challenge.length + 8);
  return argon2id({
    password: pw,
    salt: ticketSalt(challenge),
    parallelism: 1,
    iterations: TICKET_PASSES,
    memorySize: TICKET_MEM_KIB,
    hashLength: 32,
    outputType: "hex",
  });
}

/** Grid hex (nibble or legacy byte-pair) → raw cell bytes. */
export function gridHexToBytes(hex: string, n: number): Uint8Array {
  const h = hex.toLowerCase();
  if (h.length === 2 * n * n) {
    const out = new Uint8Array(2 * n * n);
    for (let i = 0; i < h.length; i++) out[i] = parseInt(h[i], 16);
    return out;
  }
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < h.length; i += 2) out[i / 2] = parseInt(h.slice(i, i + 2), 16);
  return out;
}

/** Full v1 verify: format, eligibility, ticket match, AND climb moat —
 * the grid must be exactly what (challenge, nonce) derives to at the
 * fixed budget. Hand-crafted grids never pass, however good they score. */
export async function verifyLottery(input: {
  challenge: string;
  bar: number;
  nonce: number;
  gridHex: string;
  order: number;
  ticketHex: string;
}): Promise<boolean> {
  const g = gridFromHex(input.gridHex.toLowerCase(), input.order);
  if (!g) return false;
  if (scoreGrid(g) > input.bar) return false;
  const derived = derive(input.challenge, input.nonce, input.order);
  if (gridToHex(derived) !== input.gridHex.toLowerCase()) return false;
  const t = await ticketHex(input.challenge, input.nonce, g);
  return t === input.ticketHex.toLowerCase();
}

/** v1 grind: sample candidates, keep the eligible one with lowest ticket. */
export async function mineLottery(
  challenge: string,
  bar: number,
  maxNonces: number,
  order: number
): Promise<{ nonce: number; score: number; grid_hex: string; ticket_hex: string } | null> {
  let best: { nonce: number; score: number; grid_hex: string; ticket_hex: string } | null = null;
  for (let nonce = 0; nonce < maxNonces; nonce++) {
    const g = derive(challenge, nonce, order);
    const s = scoreGrid(g);
    if (s > bar) continue;
    const t = await ticketHex(challenge, nonce, g);
    if (!best || t < best.ticket_hex) {
      best = { nonce, score: s, grid_hex: gridToHex(g), ticket_hex: t };
    }
  }
  return best;
}
void MASK32;
