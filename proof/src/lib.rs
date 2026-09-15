//! physi-proof — puzzle proof engine for PhysiCoin v3.
//!
//! The puzzle: arrange an NxN grid where every row and column holds each
//! rank and each regiment exactly once, AND all N*N pairs are distinct
//! (a Graeco-Latin square). Order 6 is classically impossible
//! (Euler/Tarry) — miners grind approximations, verification is cheap.
//! Higher orders are bigger searches; the adjuster escalates the lattice
//! when an order gets too easy. No dependencies.

/// Fixed hill-climb budget per nonce. Same for miner and verifier.
pub const CLIMB_ITERS: usize = 1500;
/// Highest lattice order this engine implements.
pub const MAX_ORDER: u8 = 12;
/// Proof encoding version. v1 = nibble grid + lottery ticket.
pub const PROOF_VERSION: u8 = 1;
/// Argon2id cost: 8 MiB, 1 pass, 1 lane, 32-byte ticket (practice grade).
pub const TICKET_MEM_KIB: u32 = 8192;
pub const TICKET_PASSES: u32 = 1;

/// An NxN grid: each cell holds a rank and a regiment (both < N).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Grid<const N: usize> {
    pub rank: [[u8; N]; N],
    pub reg: [[u8; N]; N],
}

/// A mined proof: the winning nonce, its grid, and the verified score.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Proof<const N: usize> {
    pub nonce: u64,
    pub grid: Grid<N>,
    pub score: u32,
}

// ---------------------------------------------------------------------------
// SHA-256 (FIPS 180-4, standard implementation)
// ---------------------------------------------------------------------------

const K: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

pub fn sha256(msg: &[u8]) -> [u8; 32] {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    let mut data = msg.to_vec();
    let bit_len = (msg.len() as u64).wrapping_mul(8);
    data.push(0x80);
    while data.len() % 64 != 56 {
        data.push(0);
    }
    data.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in data.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([chunk[4 * i], chunk[4 * i + 1], chunk[4 * i + 2], chunk[4 * i + 3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let t1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g; g = f; f = e;
            e = d.wrapping_add(t1);
            d = c; c = b; b = a;
            a = t1.wrapping_add(t2);
        }
        h[0] = h[0].wrapping_add(a); h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c); h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e); h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g); h[7] = h[7].wrapping_add(hh);
    }

    let mut out = [0u8; 32];
    for (i, v) in h.iter().enumerate() {
        out[4 * i..4 * i + 4].copy_from_slice(&v.to_be_bytes());
    }
    out
}

// ---------------------------------------------------------------------------
// Deterministic PRG (SplitMix64), seeded from SHA-256(challenge || nonce)
// ---------------------------------------------------------------------------

struct SplitMix64(u64);

impl SplitMix64 {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E3779B97F4A7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
        z ^ (z >> 31)
    }
    fn below(&mut self, n: usize) -> usize {
        (self.next() % (n as u64)) as usize
    }
}

fn seed_prg(challenge: &[u8], nonce: u64) -> SplitMix64 {
    let mut input = Vec::with_capacity(challenge.len() + 8);
    input.extend_from_slice(challenge);
    input.extend_from_slice(&nonce.to_le_bytes());
    let digest = sha256(&input);
    let mut seed = [0u8; 8];
    seed.copy_from_slice(&digest[..8]);
    SplitMix64(u64::from_le_bytes(seed))
}

// ---------------------------------------------------------------------------
// Scoring: row/column repeats per trait + repeated pairs grid-wide.
// score == 0 is a perfect Graeco-Latin square (impossible at order 6).
// ---------------------------------------------------------------------------

fn line_conflicts(vals: &[u8]) -> u32 {
    let mut mask: u32 = 0;
    for &v in vals.iter() {
        mask |= 1u32 << v;
    }
    (vals.len() as u32) - mask.count_ones()
}

pub fn score<const N: usize>(g: &Grid<N>) -> u32 {
    let mut total = 0u32;
    for i in 0..N {
        let mut row_rank = [0u8; 64];
        let mut row_reg = [0u8; 64];
        let mut col_rank = [0u8; 64];
        let mut col_reg = [0u8; 64];
        for j in 0..N {
            row_rank[j] = g.rank[i][j];
            row_reg[j] = g.reg[i][j];
            col_rank[j] = g.rank[j][i];
            col_reg[j] = g.reg[j][i];
        }
        total += line_conflicts(&row_rank[..N]) + line_conflicts(&row_reg[..N]);
        total += line_conflicts(&col_rank[..N]) + line_conflicts(&col_reg[..N]);
    }
    // Pair uniqueness over the whole grid (N*N cells, N*N possible pairs).
    let mut seen = [false; 256];
    for i in 0..N {
        for j in 0..N {
            seen[(g.rank[i][j] as usize) * N + (g.reg[i][j] as usize)] = true;
        }
    }
    total += (N * N) as u32 - (seen[..N * N].iter().filter(|&&b| b).count() as u32);
    total
}

// ---------------------------------------------------------------------------
// Deterministic derivation: seeded build + fixed hill-climb budget.
// Miner and verifier run the SAME function — the miner just tries many
// nonces while the verifier re-runs exactly one.
// ---------------------------------------------------------------------------

fn shuffled_row<const N: usize>(prg: &mut SplitMix64) -> [u8; 64] {
    let mut row = [0u8; 64];
    for i in 0..N {
        row[i] = i as u8;
    }
    for i in (1..N).rev() {
        let j = prg.below(i + 1);
        row.swap(i, j);
    }
    row
}

fn derive<const N: usize>(challenge: &[u8], nonce: u64) -> Grid<N> {
    let mut prg = seed_prg(challenge, nonce);
    let mut rank = [[0u8; 64]; 64];
    let mut reg = [[0u8; 64]; 64];
    // Seed: every row is a random permutation (rows Latin by construction).
    for i in 0..N {
        let r = shuffled_row::<N>(&mut prg);
        let v = shuffled_row::<N>(&mut prg);
        for j in 0..N {
            rank[i][j] = r[j];
            reg[i][j] = v[j];
        }
    }
    let mut g = Grid::<N> { rank: [[0u8; N]; N], reg: [[0u8; N]; N] };
    for i in 0..N {
        for j in 0..N {
            g.rank[i][j] = rank[i][j];
            g.reg[i][j] = reg[i][j];
        }
    }
    // Hill-climb: random swaps, keep improvements. Fixed budget.
    let mut best = score(&g);
    for _ in 0..CLIMB_ITERS {
        let tweak_ranks = prg.below(2) == 0;
        let a = prg.below(N);
        let b = prg.below(N);
        let c = prg.below(N);
        let d = prg.below(N);
        if a == c && b == d {
            continue;
        }
        if tweak_ranks {
            let tmp = g.rank[a][b];
            g.rank[a][b] = g.rank[c][d];
            g.rank[c][d] = tmp;
        } else {
            let tmp = g.reg[a][b];
            g.reg[a][b] = g.reg[c][d];
            g.reg[c][d] = tmp;
        }
        let s = score(&g);
        if s <= best {
            best = s; // accept sideways moves to keep drifting
        } else if tweak_ranks {
            let tmp = g.rank[a][b];
            g.rank[a][b] = g.rank[c][d];
            g.rank[c][d] = tmp;
        } else {
            let tmp = g.reg[a][b];
            g.reg[a][b] = g.reg[c][d];
            g.reg[c][d] = tmp;
        }
    }
    g
}

// ---------------------------------------------------------------------------
// Public API: mine + verify (generic over lattice order)
// ---------------------------------------------------------------------------

/// Grind nonces until a grid scores at or under `difficulty`.
/// Returns `None` if the nonce budget runs out.
pub fn mine<const N: usize>(challenge: &[u8], difficulty: u32, max_nonces: u64) -> Option<Proof<N>> {
    for nonce in 0..max_nonces {
        let grid = derive::<N>(challenge, nonce);
        let s = score(&grid);
        if s <= difficulty {
            return Some(Proof::<N> { nonce, grid, score: s });
        }
    }
    None
}

/// Parallel miner (rayon): same result as `mine` — the LOWEST winning nonce.
pub fn mine_parallel<const N: usize>(challenge: &[u8], difficulty: u32, max_nonces: u64) -> Option<Proof<N>> {
    use rayon::prelude::*;
    (0..max_nonces).into_par_iter().find_first(|&nonce| {
        score(&derive::<N>(challenge, nonce)) <= difficulty
    }).map(|nonce| {
        let grid = derive::<N>(challenge, nonce);
        let s = score(&grid);
        Proof::<N> { nonce, grid, score: s }
    })
}

/// Cheap check: the grid must be EXACTLY what (challenge, nonce) derives
/// to (re-run once), its score must match the claim and beat difficulty.
pub fn verify<const N: usize>(challenge: &[u8], proof: &Proof<N>, difficulty: u32) -> bool {
    if proof.score > difficulty {
        return false;
    }
    let grid = derive::<N>(challenge, proof.nonce);
    grid == proof.grid && score(&grid) == proof.score
}

// ---------------------------------------------------------------------------
// Protocol layer: difficulty, retargeting with lattice escalation,
// dual-execution submit.
// ---------------------------------------------------------------------------

/// Worst possible score at order N: 4N(N-1) line + (N^2-1) pair conflicts.
pub fn max_score_for_order(n: u8) -> u32 {
    let n = n as u32;
    4 * n * (n - 1) + n * n - 1
}

/// Opening threshold estimate for a fresh order (~1/13 of worst).
/// Retargeting corrects it within a few rounds.
pub fn opening_threshold(n: u8) -> u32 {
    (max_score_for_order(n) / 13).max(4)
}

/// Network difficulty: which lattice, and what score beats it.
/// Calibration (order 6): <=16 instant, <=10 ~dozens of nonces,
/// <=8 ~hundreds. 0 is classically unreachable at order 6 — a 0
/// submission is treated as a flawless (quantum) signature.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Difficulty {
    pub lattice_order: u8,
    pub max_score: u32,
}

pub const GENESIS_DIFFICULTY: Difficulty = Difficulty { lattice_order: 6, max_score: 10 };

/// One observed block: the winning score and seconds since the last block.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BlockSample {
    pub score: u32,
    pub interval_secs: u64,
}

/// Retarget difficulty from recent blocks toward `target_secs` per block.
/// - Any flawless (score 0) submission escalates the LATTICE: order + 1
///   (capped at MAX_ORDER) with a fresh opening threshold. The grid grows
///   because the old one got solved.
/// - Slow blocks ease off (+1, capped at worst); fast blocks tighten
///   (-1, floored at 1); on-target blocks change nothing.
pub fn retarget(prev: Difficulty, target_secs: u64, samples: &[BlockSample]) -> Difficulty {
    if samples.is_empty() {
        return prev;
    }
    if samples.iter().any(|s| s.score == 0) {
        let order = (prev.lattice_order + 1).min(MAX_ORDER);
        return Difficulty { lattice_order: order, max_score: opening_threshold(order) };
    }
    let avg = samples.iter().map(|s| s.interval_secs).sum::<u64>() / (samples.len() as u64);
    if avg > target_secs * 6 / 5 {
        Difficulty { max_score: (prev.max_score + 1).min(max_score_for_order(prev.lattice_order)), ..prev }
    } else if avg < target_secs * 4 / 5 {
        Difficulty { max_score: prev.max_score.saturating_sub(1).max(1), ..prev }
    } else {
        prev
    }
}

pub mod quantum;

// ---------------------------------------------------------------------------
// Lottery: eligibility (score <= bar) separates from winning (lowest
// ticket). Ticket = Argon2id over challenge || nonce || grid — memory-hard,
// so raw speed and future quantum search buy little; any CPU competes.
// ---------------------------------------------------------------------------

use argon2::{Algorithm, Argon2, Params, Version};

/// Lottery ticket for a candidate: 32 bytes, lower wins.
pub fn ticket<const N: usize>(challenge: &[u8], nonce: u64, grid: &Grid<N>) -> [u8; 32] {
    let mut pw = Vec::with_capacity(challenge.len() + 8 + 2 * N * N);
    pw.extend_from_slice(challenge);
    pw.extend_from_slice(&nonce.to_le_bytes());
    pw.extend_from_slice(&grid.to_bytes());
    // Salt is fixed per challenge (verifier recomputes it identically).
    let mut salt_input = Vec::with_capacity(16 + challenge.len());
    salt_input.extend_from_slice(b"PHYSI-LOTTERY-V1");
    salt_input.extend_from_slice(challenge);
    let digest = sha256(&salt_input);
    let mut salt = [0u8; 16];
    salt.copy_from_slice(&digest[..16]);
    let params = Params::new(TICKET_MEM_KIB, TICKET_PASSES, 1, Some(32))
        .expect("valid ticket params");
    let ctx = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = [0u8; 32];
    ctx.hash_password_into(&pw, &salt, &mut out).expect("ticket hash");
    out
}

pub fn ticket_hex<const N: usize>(challenge: &[u8], nonce: u64, grid: &Grid<N>) -> String {
    ticket(challenge, nonce, grid).iter().map(|b| format!("{:02x}", b)).collect()
}

/// Lottery grind: sample up to max_nonces candidates, keep the eligible
/// one (score <= bar) with the LOWEST ticket. Returns None if none qualify.
pub fn mine_lottery<const N: usize>(
    challenge: &[u8],
    bar: u32,
    max_nonces: u64,
) -> Option<(Proof<N>, [u8; 32])> {
    let mut best: Option<(Proof<N>, [u8; 32])> = None;
    for nonce in 0..max_nonces {
        let grid = derive::<N>(challenge, nonce);
        let s = score(&grid);
        if s > bar {
            continue;
        }
        let t = ticket(challenge, nonce, &grid);
        let better = match &best {
            None => true,
            Some((_, bt)) => t < *bt,
        };
        if better {
            best = Some((Proof::<N> { nonce, grid, score: s }, t));
        }
    }
    best
}

/// Dual-execution submit: probe the quantum hook first (order 6 only),
/// fall back to the classical parallel grind.
#[derive(Debug, PartialEq, Eq)]
pub enum SubmitError {
    UnsupportedLatticeOrder(u8),
    BudgetExhausted,
}

pub fn submit<const N: usize>(challenge: &[u8], diff: &Difficulty, max_nonces: u64) -> Result<Proof<N>, SubmitError> {
    if diff.lattice_order != N as u8 {
        return Err(SubmitError::UnsupportedLatticeOrder(diff.lattice_order));
    }
    if N == 6 {
        if let Ok(grid) = quantum::try_quantum_mine(challenge) {
            let s = score(&grid);
            if s <= diff.max_score {
                return Ok(Proof::<N> { nonce: u64::MAX, grid: convert_6(grid), score: s });
            }
        }
    }
    mine_parallel::<N>(challenge, diff.max_score, max_nonces).ok_or(SubmitError::BudgetExhausted)
}

/// Protocol-level verify: lattice order must match, then the cheap check.
pub fn verify_protocol<const N: usize>(challenge: &[u8], proof: &Proof<N>, diff: &Difficulty) -> bool {
    diff.lattice_order == N as u8 && verify::<N>(challenge, proof, diff.max_score)
}

// ---------------------------------------------------------------------------
// Byte encoding (2*N*N bytes grid) for storage / transport.
// ---------------------------------------------------------------------------

impl<const N: usize> Grid<N> {
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(2 * N * N);
        for i in 0..N {
            for j in 0..N {
                out.push(self.rank[i][j]);
            }
        }
        for i in 0..N {
            for j in 0..N {
                out.push(self.reg[i][j]);
            }
        }
        out
    }
    pub fn from_bytes(b: &[u8]) -> Option<Grid<N>> {
        if b.len() != 2 * N * N {
            return None;
        }
        let mut g = Grid::<N> { rank: [[0u8; N]; N], reg: [[0u8; N]; N] };
        for i in 0..N {
            for j in 0..N {
                let r = b[i * N + j];
                let v = b[N * N + i * N + j];
                if r >= N as u8 || v >= N as u8 {
                    return None;
                }
                g.rank[i][j] = r;
                g.reg[i][j] = v;
            }
        }
        Some(g)
    }
}

impl<const N: usize> Proof<N> {
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(12 + 2 * N * N);
        out.extend_from_slice(&self.nonce.to_le_bytes());
        out.extend_from_slice(&self.score.to_le_bytes());
        out.extend_from_slice(&self.grid.to_bytes());
        out
    }
    pub fn from_bytes(b: &[u8]) -> Option<Proof<N>> {
        if b.len() != 12 + 2 * N * N {
            return None;
        }
        let mut nb = [0u8; 8];
        nb.copy_from_slice(&b[..8]);
        let mut sb = [0u8; 4];
        sb.copy_from_slice(&b[8..12]);
        let grid = Grid::<N>::from_bytes(&b[12..])?;
        Some(Proof::<N> {
            nonce: u64::from_le_bytes(nb),
            grid,
            score: u32::from_le_bytes(sb),
        })
    }
}

// ---------------------------------------------------------------------------
// Internal: bridge the order-6 quantum stub into generic code.
// The stub only speaks 6x6; submit() only calls this when N == 6.
// ---------------------------------------------------------------------------

fn convert_6<const N: usize>(g: Grid<6>) -> Grid<N> {
    assert!(N == 6, "quantum stub only implements order 6");
    let mut out = Grid::<N> { rank: [[0u8; N]; N], reg: [[0u8; N]; N] };
    for i in 0..N {
        for j in 0..N {
            out.rank[i][j] = g.rank[i][j];
            out.reg[i][j] = g.reg[i][j];
        }
    }
    out
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(digest: &[u8; 32]) -> String {
        digest.iter().map(|b| format!("{:02x}", b)).collect()
    }

    #[test]
    fn sha256_known_vector() {
        assert_eq!(
            hex(&sha256(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn uniform_grid_scores_max() {
        // Order 6: 12 lines x 2 traits x 5 + 35 pairs = 155.
        let g = Grid::<6> { rank: [[0u8; 6]; 6], reg: [[0u8; 6]; 6] };
        assert_eq!(score(&g), 155);
        assert_eq!(score(&g), max_score_for_order(6));
    }

    #[test]
    fn cyclic_latin_rows_score_column_conflicts_only() {
        let mut g = Grid::<6> { rank: [[0u8; 6]; 6], reg: [[0u8; 6]; 6] };
        for i in 0..6 {
            for j in 0..6 {
                g.rank[i][j] = ((i + j) % 6) as u8;
            }
        }
        // ranks 0 + regs 60 + pairs 30 = 90.
        assert_eq!(score(&g), 90);
    }

    #[test]
    fn derive_is_deterministic() {
        let a = derive::<6>(b"physicoin-test", 7);
        let b = derive::<6>(b"physicoin-test", 7);
        assert_eq!(a, b);
        let c = derive::<6>(b"physicoin-test", 8);
        assert_ne!(a, c);
    }

    #[test]
    fn mine_easy_always_succeeds_and_verifies() {
        let p = mine::<6>(b"physicoin-test", 155, 4).expect("trivial difficulty must hit");
        assert!(verify::<6>(b"physicoin-test", &p, 155));
    }

    #[test]
    fn verify_rejects_tampering() {
        let p = mine::<6>(b"physicoin-test", 155, 4).expect("proof");
        assert!(!verify::<6>(b"other-challenge", &p, 155));
        let mut bad = p.clone();
        bad.grid.rank[0][0] = (bad.grid.rank[0][0] + 1) % 6;
        assert!(!verify::<6>(b"physicoin-test", &bad, 155));
        let mut bad2 = p.clone();
        bad2.score = 0;
        assert!(!verify::<6>(b"physicoin-test", &bad2, 155));
        assert!(!verify::<6>(b"physicoin-test", &p, 0));
    }

    #[test]
    fn classical_grind_cannot_reach_perfection_cheaply() {
        let mut best = u32::MAX;
        for nonce in 0..50 {
            best = best.min(score(&derive::<6>(b"physicoin-test", nonce)));
        }
        assert!(best > 0, "6x6 perfection must stay out of cheap reach");
    }

    #[test]
    fn bytes_round_trip() {
        let p = mine::<6>(b"physicoin-test", 155, 4).expect("proof");
        let bytes = p.to_bytes();
        assert_eq!(bytes.len(), 12 + 72);
        let back = Proof::<6>::from_bytes(&bytes).expect("round trip");
        assert_eq!(p, back);
        assert!(verify::<6>(b"physicoin-test", &back, 155));
        let mut bad = bytes.clone();
        bad[12] = 9;
        assert!(Proof::<6>::from_bytes(&bad).is_none());
    }

    #[test]
    fn order_seven_runs_and_scores() {
        // 7x7: engine runs, worst case matches the formula.
        let g = Grid::<7> { rank: [[0u8; 7]; 7], reg: [[0u8; 7]; 7] };
        assert_eq!(score(&g), max_score_for_order(7));
        let d = derive::<7>(b"physicoin-test", 3);
        assert!(score(&d) < max_score_for_order(7));
        let p = mine::<7>(b"physicoin-test", 200, 8).expect("7x7 easy mine");
        assert!(verify::<7>(b"physicoin-test", &p, 200));
        assert_eq!(p.grid.to_bytes().len(), 98);
    }

    #[test]
    fn parallel_matches_serial() {
        let s = mine::<6>(b"physicoin-test", 60, 64).expect("serial proof");
        let p = mine_parallel::<6>(b"physicoin-test", 60, 64).expect("parallel proof");
        assert_eq!(s, p, "parallel must find the same lowest winning nonce");
    }

    #[test]
    fn retarget_behaves() {
        let d = Difficulty { lattice_order: 6, max_score: 10 };
        assert_eq!(retarget(d, 60, &[]), d);
        // Slow blocks ease off; fast blocks tighten; on-target holds.
        let slow = [BlockSample { score: 9, interval_secs: 120 }];
        assert_eq!(retarget(d, 60, &slow).max_score, 11);
        let fast = [BlockSample { score: 9, interval_secs: 10 }];
        assert_eq!(retarget(d, 60, &fast).max_score, 9);
        let steady = [BlockSample { score: 9, interval_secs: 60 }];
        assert_eq!(retarget(d, 60, &steady), d);
    }

    #[test]
    fn retarget_escalates_the_lattice_on_flawless() {
        let d = Difficulty { lattice_order: 6, max_score: 10 };
        let esc = retarget(d, 60, &[BlockSample { score: 0, interval_secs: 1 }]);
        assert_eq!(esc.lattice_order, 7);
        assert_eq!(esc.max_score, opening_threshold(7));
        // Floor: order never exceeds MAX_ORDER.
        let top = Difficulty { lattice_order: MAX_ORDER, max_score: 5 };
        let esc2 = retarget(top, 60, &[BlockSample { score: 0, interval_secs: 1 }]);
        assert_eq!(esc2.lattice_order, MAX_ORDER);
    }

    #[test]
    fn submit_protocol() {
        let ok = submit::<6>(b"physicoin-test", &GENESIS_DIFFICULTY, 2000).expect("submit");
        assert!(verify_protocol::<6>(b"physicoin-test", &ok, &GENESIS_DIFFICULTY));
        let future = Difficulty { lattice_order: 13, max_score: 10 };
        assert_eq!(
            submit::<6>(b"physicoin-test", &future, 8),
            Err(SubmitError::UnsupportedLatticeOrder(13))
        );
        let impossible = Difficulty { lattice_order: 6, max_score: 0 };
        assert_eq!(
            submit::<6>(b"physicoin-test", &impossible, 4),
            Err(SubmitError::BudgetExhausted)
        );
    }
}
