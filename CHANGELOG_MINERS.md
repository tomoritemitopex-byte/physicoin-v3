# Miner changelog — what changed for miners, per deploy. Three lines.

## 2026-09-15 — lottery + ownership + history
- Rounds are now lottery: any grid under the bar qualifies, lowest ticket wins (best grid can lose).
- Submits require your wallet's session token (POST /api/auth/session first); max 25 submits/round.
- New: /app/rounds history + leaderboard (test_* wallets don't rank), NODE_GUIDE documents every reply code.

## 2026-09-15 — adaptive rounds
- 2-minute rounds, per-round bar retarget, lattice grows 6→7→… on flawless rounds.

## 2026-09-15 — public launch
- Site live at https://physicoin-v3.vercel.app, fresh economy, 31 tables.
- External submits accepted (both challenge shapes, both grid formats).
