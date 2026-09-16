# Miner changelog — what changed for miners, per deploy. Three lines.

## 2026-09-16 — re-audit fixes (his list, all proven live)
- Stored scores are recomputed (lied 0 stored as 15); legacy 144-char grids verify and normalize; 007 gap closed.
- Passwords required (enroll once, locked); every mutating route checks your session; nickname inboxes work.
- If you ran before this: re-enroll is NOT needed (no passwords existed), but old sessions are dead — fetch fresh tokens.

## 2026-09-15 — lottery + ownership + history
- Rounds are now lottery: any grid under the bar qualifies, lowest ticket wins (best grid can lose).
- Submits require your wallet's session token (POST /api/auth/session first); max 25 submits/round.
- New: /app/rounds history + leaderboard (test_* wallets don't rank), NODE_GUIDE documents every reply code.

## 2026-09-15 — adaptive rounds
- 2-minute rounds, per-round bar retarget, lattice grows 6→7→… on flawless rounds.

## 2026-09-15 — public launch
- Site live at https://physicoin-v3.vercel.app, fresh economy, 31 tables.
- External submits accepted (both challenge shapes, both grid formats).
