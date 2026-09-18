//! physi-proof CLI: the bridge between the website (Node) and the engine.
//!   physi-proof mine         <challenge> <max_score> <max_nonces> [order]
//!   physi-proof mine-lottery <challenge> <bar> <max_nonces> [order]
//!   physi-proof verify       <challenge> <max_score> <nonce> <grid_hex> [order]
//!   physi-proof ticket       <challenge> <nonce> <grid_hex> [order]
//! Exit 0 on success/OK, 2 on FAIL-or-error. Never prints a fake proof.
use physi_proof::{mine_parallel, mine_lottery, ticket_hex, verify, Grid, MAX_ORDER};

/// Grid transport: ONE hex char per cell (values are always < 16).
/// A 6x6 grid is 72 chars; order N is 2*N*N chars.
fn hex_encode_cells(b: &[u8]) -> String {
    b.iter().map(|x| char::from_digit(*x as u32, 16).unwrap_or('?')).collect()
}

fn hex_decode_cells(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len());
    for c in s.chars() {
        out.push(c.to_digit(16)? as u8);
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
    eprintln!("  physi-proof mine         <challenge> <max_score> <max_nonces> [order]");
    eprintln!("  physi-proof mine-lottery <challenge> <bar> <max_nonces> [order]");
    eprintln!("  physi-proof verify       <challenge> <max_score> <nonce> <grid_hex> [order]");
    eprintln!("  physi-proof ticket       <challenge> <nonce> <grid_hex> [order]");
    std::process::exit(2);
}

fn run_mine<const N: usize>(challenge: &[u8], max_score: u32, max_nonces: u64) {
    match mine_parallel::<N>(challenge, max_score, max_nonces) {
        Some(p) => {
            println!(
                "{{\"nonce\":{},\"score\":{},\"grid_hex\":\"{}\"}}",
                p.nonce,
                p.score,
                hex_encode_cells(&p.grid.to_bytes())
            );
        }
        None => {
            eprintln!("BUDGET_EXHAUSTED");
            std::process::exit(2);
        }
    }
}

fn run_verify<const N: usize>(challenge: &[u8], max_score: u32, nonce: u64, grid_hex: &str) {
    // Accept nibble form (2*N*N chars, current) and legacy byte-pair
    // form (4*N*N chars, first release binaries).
    let cells: Vec<u8> = if grid_hex.len() == 4 * N * N {
        let mut v = Vec::with_capacity(2 * N * N);
        let b = grid_hex.as_bytes();
        for i in (0..b.len()).step_by(2) {
            let hi = (b[i] as char).to_digit(16);
            let lo = (b[i + 1] as char).to_digit(16);
            match (hi, lo) {
                (Some(h), Some(l)) => v.push((h * 16 + l) as u8),
                _ => {
                    eprintln!("BAD_GRID_HEX");
                    std::process::exit(2);
                }
            }
        }
        v
    } else {
        hex_decode_cells(grid_hex).unwrap_or_else(|| usage())
    };
    if cells.len() != 2 * N * N {
        eprintln!("BAD_GRID_HEX");
        std::process::exit(2);
    }
    match Grid::<N>::from_bytes(&cells) {
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

fn run_mine_lottery<const N: usize>(challenge: &[u8], bar: u32, max_nonces: u64) {
    match mine_lottery::<N>(challenge, bar, max_nonces) {
        Some((p, t)) => {
            let th: String = t.iter().map(|b| format!("{:02x}", b)).collect();
            println!(
                "{{\"nonce\":{},\"score\":{},\"grid_hex\":\"{}\",\"ticket_hex\":\"{}\",\"version\":1}}",
                p.nonce,
                p.score,
                hex_encode_cells(&p.grid.to_bytes()),
                th
            );
        }
        None => {
            eprintln!("BUDGET_EXHAUSTED");
            std::process::exit(2);
        }
    }
}

fn run_ticket<const N: usize>(challenge: &[u8], nonce: u64, grid_hex: &str) {
    let cells: Vec<u8> = if grid_hex.len() == 4 * N * N {
        let mut v = Vec::with_capacity(2 * N * N);
        let b = grid_hex.as_bytes();
        for i in (0..b.len()).step_by(2) {
            let hi = (b[i] as char).to_digit(16);
            let lo = (b[i + 1] as char).to_digit(16);
            match (hi, lo) {
                (Some(h), Some(l)) => v.push((h * 16 + l) as u8),
                _ => {
                    eprintln!("BAD_GRID_HEX");
                    std::process::exit(2);
                }
            }
        }
        v
    } else {
        hex_decode_cells(grid_hex).unwrap_or_else(|| usage())
    };
    if cells.len() != 2 * N * N {
        eprintln!("BAD_GRID_HEX");
        std::process::exit(2);
    }
    match Grid::<N>::from_bytes(&cells) {
        Some(grid) => {
            println!("{}", ticket_hex(challenge, nonce, &grid));
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
        "mine-lottery" => {
            if args.len() != 5 && args.len() != 6 {
                usage();
            }
            let challenge = args[2].as_bytes();
            let bar: u32 = args[3].parse().unwrap_or_else(|_| usage());
            let max_nonces: u64 = args[4].parse().unwrap_or_else(|_| usage());
            let order = parse_order(args.get(5));
            dispatch!(order, run_mine_lottery, challenge, bar, max_nonces);
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
        "ticket" => {
            if args.len() != 5 && args.len() != 6 {
                usage();
            }
            let challenge = args[2].as_bytes();
            let nonce: u64 = args[3].parse().unwrap_or_else(|_| usage());
            let order = parse_order(args.get(5));
            dispatch!(order, run_ticket, challenge, nonce, args[4].as_str());
        }
        _ => usage(),
    }
}
