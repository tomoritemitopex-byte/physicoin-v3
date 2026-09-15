//! physi-proof CLI: the bridge between the website (Node) and the engine.
//!   physi-proof mine   <challenge> <max_score> <max_nonces> [order]
//!   physi-proof verify <challenge> <max_score> <nonce> <grid_hex> [order]
//! Exit 0 on success/OK, 2 on FAIL-or-error. Never prints a fake proof.
use physi_proof::{mine_parallel, verify, Grid, MAX_ORDER};

fn hex_encode(b: &[u8]) -> String {
    b.iter().map(|x| format!("{:02x}", x)).collect()
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    let bytes = s.as_bytes();
    let val = |c: u8| match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    };
    let mut out = Vec::with_capacity(s.len() / 2);
    for i in (0..bytes.len()).step_by(2) {
        out.push((val(bytes[i])? << 4) | val(bytes[i + 1])?);
    }
    Some(out)
}

fn parse_order(s: Option<&String>) -> u8 {
    match s.map(|x| x.parse().unwrap_or(6)).unwrap_or(6) {
        3..=12 => s.map(|x| x.parse().unwrap_or(6)).unwrap_or(6),
        _ => {
            eprintln!("ORDER_UNSUPPORTED (3-12)");
            std::process::exit(2);
        }
    }
}

fn usage() -> ! {
    eprintln!("usage:");
    eprintln!("  physi-proof mine   <challenge> <max_score> <max_nonces> [order]");
    eprintln!("  physi-proof verify <challenge> <max_score> <nonce> <grid_hex> [order]");
    std::process::exit(2);
}

fn run_mine<const N: usize>(challenge: &[u8], max_score: u32, max_nonces: u64) {
    match mine_parallel::<N>(challenge, max_score, max_nonces) {
        Some(p) => {
            println!(
                "{{\"nonce\":{},\"score\":{},\"grid_hex\":\"{}\"}}",
                p.nonce,
                p.score,
                hex_encode(&p.grid.to_bytes())
            );
        }
        None => {
            eprintln!("BUDGET_EXHAUSTED");
            std::process::exit(2);
        }
    }
}

fn run_verify<const N: usize>(challenge: &[u8], max_score: u32, nonce: u64, grid_hex: &str) {
    let raw = hex_decode(grid_hex).unwrap_or_else(|| usage());
    if raw.len() != 2 * N * N {
        eprintln!("BAD_GRID_HEX");
        std::process::exit(2);
    }
    match Grid::<N>::from_bytes(&raw) {
        Some(grid) => {
            let proof = physi_proof::Proof::<N> { nonce, grid, score: physi_proof::score(&grid) };
            if verify::<N>(challenge, &proof, max_score) {
                println!("OK");
            } else {
                println!("FAIL");
                std::process::exit(2);
            }
        }
        None => {
            eprintln!("BAD_GRID_VALUES");
            std::process::exit(2);
        }
    }
}

macro_rules! dispatch {
    ($order:expr, $f:ident, $($arg:expr),*) => {
        match $order {
            3 => $f::<3>($($arg),*),
            4 => $f::<4>($($arg),*),
            5 => $f::<5>($($arg),*),
            6 => $f::<6>($($arg),*),
            7 => $f::<7>($($arg),*),
            8 => $f::<8>($($arg),*),
            9 => $f::<9>($($arg),*),
            10 => $f::<10>($($arg),*),
            11 => $f::<11>($($arg),*),
            _ => $f::<{ MAX_ORDER as usize }>($($arg),*),
        }
    };
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        usage();
    }
    match args[1].as_str() {
        "mine" => {
            if args.len() != 5 && args.len() != 6 {
                usage();
            }
            let challenge = args[2].as_bytes();
            let max_score: u32 = args[3].parse().unwrap_or_else(|_| usage());
            let max_nonces: u64 = args[4].parse().unwrap_or_else(|_| usage());
            let order = parse_order(args.get(5));
            dispatch!(order, run_mine, challenge, max_score, max_nonces);
        }
        "verify" => {
            if args.len() != 6 && args.len() != 7 {
                usage();
            }
            let challenge = args[2].as_bytes();
            let max_score: u32 = args[3].parse().unwrap_or_else(|_| usage());
            let nonce: u64 = args[4].parse().unwrap_or_else(|_| usage());
            let order = parse_order(args.get(6));
            dispatch!(order, run_verify, challenge, max_score, nonce, args[5].as_str());
        }
        _ => usage(),
    }
}
