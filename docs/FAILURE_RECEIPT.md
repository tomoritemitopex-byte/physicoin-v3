# Failure receipt (contract — no screenshots, no vibes)

Copy, fill, attach to every bug report in either direction.

- **Command:** exact command or request (method + URL + key params, secrets redacted)
- **Output:** full response/error text as returned (trim proofs to first 12 chars)
- **Timestamp:** UTC, when it ran
- **Expected:** what should have happened
- **Actual:** what happened instead
- **Round/context:** round number, wallet nickname (never raw user ids in chat)

Example:
- Command: POST /api/mining {user_id, round 655, nonce, grid_hex, score, salt}
- Output: {"ok":false,"code":"BAD_PROOF","message":"Proof does not verify."}
- Timestamp: 2026-09-15T21:40:00Z
- Expected: ok:true recorded (proof verifies locally via CLI)
- Actual: BAD_PROOF on public, OK on practice — same commit
- Round/context: round 655, wallet creator_1
