# Miner guide — everything a machine needs, nothing else

## Server (also in `lib/config.ts`)
- Production: **https://physicoin-v3.vercel.app**
- Round status: `GET /api/mining?round=current`
  → `{round, lattice_order, difficulty, ends_in_secs, leader, ...}`

## Install
- Linux: download `physi-proof` from this repo's **Releases** page, `chmod +x`.
- Elsewhere: install Rust (rustup.rs), clone this repo,
  `cargo build --release -p physi-proof` (zero extra dependencies).
- Sanity: `./physi-proof mine hello 60 64` must print one JSON line:
  `{"nonce":…,"score":…,"grid_hex":"…"}`. If it does, your engine works.

## Wallet
- Create a handle: `POST <server>/api/profile`
  `{full_name, nickname, programme, level}` → save the returned user `id`.
  Nickname rules: lowercase a-z0-9_, must contain `_` and a digit.
- That `id` is the wallet. Never lose it.

## The loop (run forever, every few seconds)
1. **Read the round fresh** — `GET /api/mining?round=current`.
   Rounds last ~2 minutes. A stale round number is rejected, no exceptions.
2. **Grind ONE proof:**
   `./physi-proof mine "<round>:<wallet>:<salt>" <difficulty> 2000 [lattice_order]`
   - `<salt>`: fresh random string EVERY attempt. Reused salt = rejection.
   - Challenge also accepts a `v3-round:` prefix — either shape verifies.
   - Grid output: nibble form (72 chars for 6×6). Older binaries emit
     byte-pair form (144 chars) — the server reads both.
3. **Submit:** `POST <server>/api/mining`
   `{user_id, round, nonce, grid_hex, score, salt, token}`
   - `token`: your wallet's session — `POST <server>/api/auth/session`
     `{user_id}` → `{token}`. Submits without the wallet's own live token
     are refused (`NO_TOKEN`); a token for a different wallet is refused
     (`NOT_YOUR_WALLET`). Nobody files proofs as someone else.
   - Challenge spec (`lib/proof-challenge.ts` is the single source of
     truth — replicate exactly):
     prefixed `` v3-round:<round>:<user_id>:<salt> `` or bare
     `` <round>:<user_id>:<salt> ``. Salt fresh random per attempt.

## Reply codes — read them, don't ignore them
| Reply | Meaning | Fix |
|---|---|---|
| `ok:true recorded` | Landed. Check the leader board. | — |
| `ROUND_CLOSED` | Round number went stale mid-grind. | Fetch fresh, retry. |
| `TOO_WEAK` | Score missed the bar. | More nonces, or accept it. |
| `DUPLICATE_PROOF` | Salt reused. | Never reuse salts. |
| `BAD_PROOF` | Challenge doesn't match the mined grid. | Compare `<round>:<wallet>:<salt>` character-for-character. |
| Anything else | New territory. | Send the FULL reply to the maintainers. |

## Rules of the race
- Lowest grid score per round wins 1 $PHY. Ties: earliest submission.
- Near-flawless grids can close a round early; bars tighten when
  solving is fast; grids grow (6×6 → 7×7 → …) when orders fall.
- Every proof is re-verified server-side. Fakes are rejected, never stored.

## Honest limits (practice stage)
- Rewards, round length, and bars are practice values and will change.
- No passwords yet: wallet sessions are open. Do not put real value on this.
