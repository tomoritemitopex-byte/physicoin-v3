import Base

# Showcase — doctrine record (Bend spec, TS runtime). The strings below ARE the
# content (grid/ticket doctrine); good_score Zero{} records "score 0 wins" —
# the exhibition bar the real validator (Score.bend) and TS (proof-engine.ts)
# enforce. No logic to wire; verified via `bend --check-only`.

def good_score() -> Nat:
  Zero{}

def good_derive() -> String:
  "6×6 Latin grid — no hall double-booked, no pair duplicate, score 0 impossible, score 7 wins the exhibition"

def good_ticket() -> String:
  "0000aa — creator_1's winning ticket, lowest wins"

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Physicoin in Bend — the good stuff. Grid as sculpture, ticket as light, chain as gallery. No cheap-phone limits — this is the art.")
