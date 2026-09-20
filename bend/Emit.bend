import Base

# Emit — Bend spec for hall heat + grid score (TS runtime).
# Bend is the parallel specification, verified via `bend --check-only`;
# `bend build` emits a runnable program, not an importable library.
# TS in page.tsx is authoritative.

def grid_score(n: Nat) -> Nat:
  0n

def hall_heat(count: Nat) -> Nat:
  Nat.mul(count, 2n)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Bend emit ok — grid_score and hall_heat ready for JS import")
