# Running a PhysiCoin v3 miner (another node)

## What you need
1. The miner program — download `physi-proof` from the repo's **Releases** page
   (Linux ready to run) or build it: `cargo build --release -p physi-proof`
   (needs a Rust toolchain; zero extra dependencies).
2. The address of a running v3 server (its `/api/mining` must reach you —
   today that means the operator's machine; after public deploy, the site URL).
3. A wallet: create a handle on the site (`/join` or `/app/profile`) and save
   your user id. That id is your wallet address.

## How a round works
- Rounds last ~2 minutes. Lowest grid score wins 1 $PHY. Ties: earliest wins.
- Each round publishes its lattice size and bar (`GET /api/mining?round=current`).
- Grind: `./physi-proof mine "<round>:<wallet>:<salt>" <bar> <nonces> [order]`
  (pick any random salt per attempt — every grind must be fresh work).
- Submit: `POST /api/mining {user_id, round, nonce, grid_hex, score, salt}`.
  The server re-verifies every proof; fakes are rejected, never stored.

## Honest limits (practice stage)
- There is no public server yet — mining runs against the operator's machine.
- Rewards, round length, and difficulty bars are practice values.
- No passwords yet: wallet sessions are open. Do not put real value on this.
