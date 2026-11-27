-- v3 migration 016: one-time chain relink.
-- closeRound() used to point an empty block at block N-1's ticket only, so
-- any round that followed two or more quiet rounds was stamped
-- prev_hash = 'GENESIS' and broke the chain that verifyChain() walks.
-- Recompute prev_hash for every closed block from the last real winning
-- ticket before it — the same rule the current code applies. Derived data
-- only: no winner, score or ticket is touched.
UPDATE physi_rounds r
SET prev_hash = COALESCE((
  SELECT p.winning_ticket FROM physi_rounds p
  WHERE p.number < r.number AND p.winning_ticket IS NOT NULL
  ORDER BY p.number DESC LIMIT 1), 'GENESIS')
WHERE r.status = 'closed';
