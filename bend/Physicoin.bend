import Base

# Physicoin — module index for the Bend spec layer (Bend spec, TS runtime).
# Real logic lives per module: Score.bend (Latin row/col fork-join),
# Derive.bend (per-nonce LCG + fan-out), Lottery.bend (lowest-wins fold),
# Face.bend (parallel cell transform), Emit.bend (heat/count spec).
# The defs below are unimplemented surface placeholders (identity stubs),
# kept so `bend --check-only` gates the file in scripts/bend-check.sh.
# TS (lib/proof-engine.ts, app/) is authoritative.

def score(n: Nat) -> Nat:
  Zero{}

def derive(challenge: String, nonce: Nat) -> Nat:
  nonce

def ticket(challenge: String, nonce: Nat) -> String:
  challenge

def close_round(round: Nat, pending: Nat, best_ticket: String) -> Nat:
  round

def mine_round(round: Nat, wallets: Nat) -> Nat:
  wallets

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Physicoin in Bend — timetable is mempool, mining locks blocks, chain is timetable. Bend is the parallel spec; TS is the runtime.")
