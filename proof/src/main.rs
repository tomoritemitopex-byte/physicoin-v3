//! physi-proof CLI: the bridge between the website (Node) and the engine.
//!   physi-proof mine   <challenge> <max_score> <max_nonces> -> JSON proof
//!   physi-proof verify <challenge> <max_score> <nonce> <grid_hex> -> OK|FAIL
//! Exit 0 on success/OK, 2 on FAIL-or-error. Never prints a fake proof.
use physi_proof::{mine_parallel, verify, Grid, N};

fn hex_encode(b: &[u8]) -> String {
    b.iter().map(|x| format!("{:02x}", x)).collect()
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    let mut out = Vec::with_capacity(s.len() / 2);
    let bytes = s.as_bytes();
    let val = |c: u8| match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    };
    for i in (0..bytes.len()).step_by(2) {
        out.push((val(bytes[i])? << 4) | val(bytes[i + 1])?);
    }
    Some(out)
}

fn usage() -> ! {
    eprintln!("usage:");
    eprintln!("  physi-proof mine   <challenge> <max_score> <max_nonces>");
    eprintln!("  physi-proof verify <challenge> <max_score> <nonce> <grid_hex72>");
    std::process::exit(2);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        usage();
    }
    match args[1].as_str() {
        "mine" => {
            if args.len() != 5 {
                usage();
            }
            let challenge = args[2].as_bytes();
            let max_score: u32 = args[3].parse().unwrap_or_else(|_| usage());
            let max_nonces: u64 = args[4].parse().unwrap_or_else(|_| usage());
            match mine_parallel(challenge, max_score, max_nonces) {
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
        "verify" => {
            if args.len() != 6 {
                usage();
            }
            let challenge = args[2].as_bytes();
            let max_score: u32 = args[3].parse().unwrap_or_else(|_| usage());
            let nonce: u64 = args[4].parse().unwrap_or_else(|_| usage());
            let raw = hex_decode(&args[5]).unwrap_or_else(|| usage());
            if raw.len() != N * N * 2 {
                eprintln!("BAD_GRID_HEX");
                std::process::exit(2);
            }
            let mut gb = [0u8; 72];
            gb.copy_from_slice(&raw);
            match Grid::from_bytes(&gb) {
                Some(grid) => {
                    let proof = physi_proof::Proof { nonce, grid, score: physi_proof::score(&grid) };
                    if verify(challenge, &proof, max_score) {
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
        _ => usage(),
    }
}
