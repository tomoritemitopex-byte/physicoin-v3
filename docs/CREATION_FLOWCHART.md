# Creation Flowchart — slips → blocks (nothing destroyed)

Use this as the build map, not page content. Every step is additive.

```
Post slip (Road) ──POST /api/timetable──► Mempool (physi_events pending, 12 max)
                                          │
                                          │ SELECT pending ORDER BY created_at
                                          ▼
                          Mining ── mine-lottery <bar> ──► score ≤ bar ? ticket (Argon2id)
                                          │
                                          │ POST /api/mining {salt, ticket} + session
                                          ▼
                              Block ── closeRound() picks lowest ticket
                                        prev_hash = prev winning_ticket else GENESIS
                                        tx_root = SHA256(sorted pending ids) else GENESIS
                                        → physi_block_txs + physi_events→verified
                                        → physi_schedule_versions (version=n, grid)
                                        +1 PHY, ghost_chain, invite 0.5
                                          │
                                          ▼
                              Chain ── GET /api/rounds?round=n → {block, txs}
                                        GET /api/schedule → gridToSchedule() → 08:00-18:00 × halls
```

Rules baked in:
- lottery: lowest ticket wins, not best score (score only buys a ticket)
- moat: grid must derive from (challenge,nonce) at fixed 1,500 climbs — hand-made grids fail
- cap: bar never exceeds barCap (random grids ~60), so eligibility always costs grinding
- chain: every header commits prev_hash + tx_root — empty block = GENESIS, still chained
- preservation: 011_block_txs + 010_schedule are append-only; no DROP/DELETE of existing tables or routes
