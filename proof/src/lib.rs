//! physi-proof — puzzle proof engine for PhysiCoin v3.
//!
//! The puzzle: arrange a 6x6 grid where every row and column holds each
//! rank (0..6) and each regiment (0..6) exactly once (a Graeco-Latin
//! square). Classically the perfect grid is unreachable (Euler/Tarry),
//! so miners grind: each nonce seeds a candidate, matrix hill-climbing
//! improves it, and the best grid under the difficulty threshold wins.
//! Verification is cheap: re-derive from (challenge, nonce) and re-score.
//! No dependencies — SHA-256 and the PRG are hand-rolled below.

pub const N: usize = 6;
/// Fixed hill-climb budget per nonce. Same for miner and verifier.
pub const CLIMB_ITERS: usize = 1500;

/// A 6x6 grid: each cell holds a rank and a regiment (both 0..6).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Grid {
    pub rank: [[u8; N]; N],
    pub reg: [[u8; N]; N],
}

/// A mined proof: the winning nonce, its grid, and the verified score.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Proof {
    pub nonce: u64,
    pub grid: Grid,
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
// Scoring: count rank/regiment repeats in every row and column, PLUS
// repeated (rank, regiment) pairs across the whole grid.
// score == 0 means a perfect Graeco-Latin square — all rows, all columns
// AND all 36 pairs distinct. (Pairs are the hard part: Euler/Tarry.)
// ---------------------------------------------------------------------------

fn line_conflicts(vals: &[u8; N]) -> u32 {
    let mut mask: u8 = 0;
    for &v in vals.iter() {
        mask |= 1u8 << v;
    }
    (N as u32) - (mask.count_ones())
}

pub fn score(g: &Grid) -> u32 {
    let mut total = 0u32;
    for i in 0..N {
        let mut row_rank = [0u8; N];
        let mut row_reg = [0u8; N];
        let mut col_rank = [0u8; N];
        let mut col_reg = [0u8; N];
        for j in 0..N {
            row_rank[j] = g.rank[i][j];
            row_reg[j] = g.reg[i][j];
            col_rank[j] = g.rank[j][i];
            col_reg[j] = g.reg[j][i];
        }
        total += line_conflicts(&row_rank) + line_conflicts(&row_reg);
        total += line_conflicts(&col_rank) + line_conflicts(&col_reg);
    }
    // Pair uniqueness over the whole grid (36 cells, 36 possible pairs).
    let mut seen = [false; 36];
    for i in 0..N {
        for j in 0..N {
            seen[(g.rank[i][j] as usize) * N + (g.reg[i][j] as usize)] = true;
        }
    }
    total += 36 - (seen.iter().filter(|&&b| b).count() as u32);
    total
}

// ---------------------------------------------------------------------------
// Deterministic derivation: seeded build + fixed hill-climb budget.
// Miner and verifier run the SAME function — the miner just tries many
// nonces while the verifier re-runs exactly one.
// ---------------------------------------------------------------------------

fn shuffled_row(prg: &mut SplitMix64) -> [u8; N] {
    let mut row = [0u8, 1, 2, 3, 4, 5];
    for i in (1..N).rev() {
        let j = prg.below(i + 1);
        row.swap(i, j);
    }
    row
}

fn derive(challenge: &[u8], nonce: u64) -> Grid {
    let mut prg = seed_prg(challenge, nonce);
    let mut g = Grid {
        rank: [[0u8; N]; N],
        reg: [[0u8; N]; N],
    };
    // Seed: every row is a random permutation (rows Latin by construction).
    for i in 0..N {
        g.rank[i] = shuffled_row(&mut prg);
        g.reg[i] = shuffled_row(&mut prg);
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
// Public API: mine + verify
// ---------------------------------------------------------------------------

/// Grind nonces until a grid scores at or under `difficulty`
/// (lower = harder). Returns `None` if the nonce budget runs out.
pub fn mine(challenge: &[u8], difficulty: u32, max_nonces: u64) -> Option<Proof> {
    for nonce in 0..max_nonces {
        let grid = derive(challenge, nonce);
        let s = score(&grid);
        if s <= difficulty {
            return Some(Proof { nonce, grid, score: s });
        }
    }
    None
}

/// Parallel miner (rayon): same result as `mine` — the LOWEST winning
/// nonce — found with all CPU cores grinding different nonces at once.
pub fn mine_parallel(challenge: &[u8], difficulty: u32, max_nonces: u64) -> Option<Proof> {
    use rayon::prelude::*;
    (0..max_nonces).into_par_iter().find_first(|&nonce| {
        score(&derive(challenge, nonce)) <= difficulty
    }).map(|nonce| {
        let grid = derive(challenge, nonce);
        let s = score(&grid);
        Proof { nonce, grid, score: s }
    })
}

/// Cheap check: the grid must be EXACTLY what (challenge, nonce) derives
/// to (re-run once), its score must match the claim and beat difficulty.
pub fn verify(challenge: &[u8], proof: &Proof, difficulty: u32) -> bool {
    if proof.score > difficulty {
        return false;
    }
    let grid = derive(challenge, proof.nonce);
    grid == proof.grid && score(&grid) == proof.score
}

// ---------------------------------------------------------------------------
// Protocol layer: difficulty, retargeting, dual-execution submit.
// ---------------------------------------------------------------------------

/// Worst possible score (uniform grid): 120 line + 35 pair conflicts.
pub const MAX_SCORE: u32 = 155;
/// Lattice order actually implemented by this engine.
pub const IMPLEMENTED_LATTICE_ORDER: u8 = 6;

/// Network difficulty: which lattice, and what score beats it.
/// Calibration (6x6, release build): <=16 instant, <=10 ~dozens of
/// nonces, <=8 ~hundreds. 0 is classically unreachable (Euler/Tarry) —
/// a 0 submission is treated as a flawless (quantum) signature.
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
/// - Any flawless (score 0) submission halves the threshold: the network
///   got stronger, so the puzzle must get harder. Lattice-order escalation
///   stays parked at 6 until larger lattices are implemented — scheduling
///   an unbuildable order today would stall the chain, so we never do.
/// - Slow blocks ease off (+1, capped at MAX_SCORE); fast blocks tighten
///   (-1, floored at 1); on-target blocks change nothing.
pub fn retarget(prev: Difficulty, target_secs: u64, samples: &[BlockSample]) -> Difficulty {
    if samples.is_empty() {
        return prev;
    }
    if samples.iter().any(|s| s.score == 0) {
        return Difficulty {
            lattice_order: IMPLEMENTED_LATTICE_ORDER,
            max_score: (prev.max_score / 2).max(1),
        };
    }
    let avg = samples.iter().map(|s| s.interval_secs).sum::<u64>() / (samples.len() as u64);
    if avg > target_secs * 6 / 5 {
        Difficulty { max_score: (prev.max_score + 1).min(MAX_SCORE), ..prev }
    } else if avg < target_secs * 4 / 5 {
        Difficulty { max_score: prev.max_score.saturating_sub(1).max(1), ..prev }
    } else {
        prev
    }
}

pub mod quantum;

/// Dual-execution submit: probe the quantum hook first, fall back to the
/// classical parallel grind. Today the hook always reports hardware
/// absent, so every block is classically mined — the quantum path is
/// wired and waiting, not pretending.
#[derive(Debug, PartialEq, Eq)]
pub enum SubmitError {
    UnsupportedLatticeOrder(u8),
    BudgetExhausted,
}

pub fn submit(challenge: &[u8], diff: &Difficulty, max_nonces: u64) -> Result<Proof, SubmitError> {
    if diff.lattice_order != IMPLEMENTED_LATTICE_ORDER {
        return Err(SubmitError::UnsupportedLatticeOrder(diff.lattice_order));
    }
    if let Ok(grid) = quantum::try_quantum_mine(challenge) {
        let s = score(&grid);
        if s <= diff.max_score {
            return Ok(Proof { nonce: u64::MAX, grid, score: s });
        }
        // Flawless path failed its own bar (cannot happen while the
        // stub is absent) — fall through to classical mining.
    }
    mine_parallel(challenge, diff.max_score, max_nonces).ok_or(SubmitError::BudgetExhausted)
}

/// Protocol-level verify: lattice order must match, then the cheap check.
pub fn verify_protocol(challenge: &[u8], proof: &Proof, diff: &Difficulty) -> bool {
    diff.lattice_order == IMPLEMENTED_LATTICE_ORDER && verify(challenge, proof, diff.max_score)
}

// ---------------------------------------------------------------------------
// Byte encoding (72-byte grid, 84-byte proof) for storage / transport.
// ---------------------------------------------------------------------------

impl Grid {
    pub fn to_bytes(&self) -> [u8; 72] {
        let mut out = [0u8; 72];
        for i in 0..N {
            for j in 0..N {
                out[i * N + j] = self.rank[i][j];
                out[36 + i * N + j] = self.reg[i][j];
            }
        }
        out
    }
    pub fn from_bytes(b: &[u8; 72]) -> Option<Grid> {
        let mut g = Grid { rank: [[0u8; N]; N], reg: [[0u8; N]; N] };
        for i in 0..N {
            for j in 0..N {
                let r = b[i * N + j];
                let v = b[36 + i * N + j];
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

impl Proof {
    pub fn to_bytes(&self) -> [u8; 84] {
        let mut out = [0u8; 84];
        out[..8].copy_from_slice(&self.nonce.to_le_bytes());
        out[8..12].copy_from_slice(&self.score.to_le_bytes());
        out[12..].copy_from_slice(&self.grid.to_bytes());
        out
    }
    pub fn from_bytes(b: &[u8; 84]) -> Option<Proof> {
        let mut gb = [0u8; 72];
        gb.copy_from_slice(&b[12..]);
        let grid = Grid::from_bytes(&gb)?;
        let mut nb = [0u8; 8];
        nb.copy_from_slice(&b[..8]);
        let mut sb = [0u8; 4];
        sb.copy_from_slice(&b[8..12]);
        Some(Proof {
            nonce: u64::from_le_bytes(nb),
            grid,
            score: u32::from_le_bytes(sb),
        })
    }
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
        // Every line: 1 distinct value out of 6 -> 5 conflicts per trait.
        // 12 lines x 2 traits x 5 = 120, plus 35 pair conflicts (1 pair seen) = 155.
        let g = Grid { rank: [[0u8; N]; N], reg: [[0u8; N]; N] };
        assert_eq!(score(&g), 155);
    }

    #[test]
    fn cyclic_latin_rows_score_column_conflicts_only() {
        // Ranks: cyclic Latin square (rows AND columns Latin for ranks).
        // Regs: uniform -> max reg conflicts. Ranks contribute 0.
        // Pairs: (c, 0) for c in 0..6 -> 6 distinct of 36 -> 30 pair conflicts.
        let mut g = Grid { rank: [[0u8; N]; N], reg: [[0u8; N]; N] };
        for i in 0..N {
            for j in 0..N {
                g.rank[i][j] = ((i + j) % N) as u8;
            }
        }
        // ranks: 0 conflicts; regs: 12 lines x 5 = 60; pairs: 30. Total 90.
        assert_eq!(score(&g), 90);
    }

    #[test]
    fn derive_is_deterministic() {
        let a = derive(b"physicoin-test", 7);
        let b = derive(b"physicoin-test", 7);
        assert_eq!(a, b);
        let c = derive(b"physicoin-test", 8);
        assert_ne!(a, c);
    }

    #[test]
    fn mine_easy_always_succeeds_and_verifies() {
        let p = mine(b"physicoin-test", 120, 4).expect("trivial difficulty must hit");
        assert!(verify(b"physicoin-test", &p, 120));
    }

    #[test]
    fn verify_rejects_tampering() {
        let p = mine(b"physicoin-test", 120, 4).expect("proof");
        // Wrong challenge.
        assert!(!verify(b"other-challenge", &p, 120));
        // Tampered grid.
        let mut bad = p;
        bad.grid.rank[0][0] = (bad.grid.rank[0][0] + 1) % N as u8;
        assert!(!verify(b"physicoin-test", &bad, 120));
        // Lied-about score.
        let mut bad2 = p;
        bad2.score = 0;
        assert!(!verify(b"physicoin-test", &bad2, 120));
        // Difficulty not met.
        assert!(!verify(b"physicoin-test", &p, 0));
    }

    #[test]
    fn classical_grind_cannot_reach_perfection_cheaply() {
        // Fixed tiny budget: no nonce in range reaches the fabled 0.
        // (Deterministic — same result on every run.)
        let mut best = u32::MAX;
        for nonce in 0..50 {
            best = best.min(score(&derive(b"physicoin-test", nonce)));
        }
        assert!(best > 0, "6x6 perfection must stay out of cheap reach");
    }

    #[test]
    fn bytes_round_trip() {        let p = mine(b"physicoin-test", 120, 4).expect("proof");
        let bytes = p.to_bytes();
        assert_eq!(bytes.len(), 84);
        let back = Proof::from_bytes(&bytes).expect("round trip");
        assert_eq!(p, back);
        assert!(verify(b"physicoin-test", &back, 120));
        let mut bad = bytes;
        bad[12] = 9; // invalid cell value
        assert!(Proof::from_bytes(&bad).is_none());
    }

    #[test]
    fn parallel_matches_serial() {
        let s = mine(b"physicoin-test", 60, 64).expect("serial proof");
        let p = mine_parallel(b"physicoin-test", 60, 64).expect("parallel proof");
        assert_eq!(s, p, "parallel must find the same lowest winning nonce");
    }

    #[test]
    fn retarget_behaves() {
        let d = Difficulty { lattice_order: 6, max_score: 10 };
        // No data -> unchanged.
        assert_eq!(retarget(d, 60, &[]), d);
        // Flawless submission -> threshold halves, order parked at 6.
        let esc = retarget(d, 60, &[BlockSample { score: 0, interval_secs: 1 }]);
        assert_eq!(esc, Difficulty { lattice_order: 6, max_score: 5 });
        // Floor at 1, never 0 (0 would demand the impossible every block).
        let tiny = Difficulty { lattice_order: 6, max_score: 1 };
        assert_eq!(retarget(tiny, 60, &[BlockSample { score: 0, interval_secs: 1 }]).max_score, 1);
        // Slow blocks ease off; fast blocks tighten; on-target holds.
        let slow = [BlockSample { score: 9, interval_secs: 120 }];
        assert_eq!(retarget(d, 60, &slow).max_score, 11);
        let fast = [BlockSample { score: 9, interval_secs: 10 }];
        assert_eq!(retarget(d, 60, &fast).max_score, 9);
        let steady = [BlockSample { score: 9, interval_secs: 60 }];
        assert_eq!(retarget(d, 60, &steady), d);
    }

    #[test]
    fn submit_protocol() {
        let ok = submit(b"physicoin-test", &GENESIS_DIFFICULTY, 2000).expect("submit");
        assert!(verify_protocol(b"physicoin-test", &ok, &GENESIS_DIFFICULTY));
        let future = Difficulty { lattice_order: 12, max_score: 10 };
        assert_eq!(
            submit(b"physicoin-test", &future, 8),
            Err(SubmitError::UnsupportedLatticeOrder(12))
        );
        let impossible = Difficulty { lattice_order: 6, max_score: 0 };
        assert_eq!(
            submit(b"physicoin-test", &impossible, 4),
            Err(SubmitError::BudgetExhausted)
        );
    }
}
