import Base

# Emit — Bend → JS for Next.js import (hall heat + grid score)
# Trivial, deterministic, parallel-ready: compiled via `bend build bend/Emit.bend -o <out>.js`
# Next.js can `import { hall_heat, grid_score } from "@/bend/Emit.js"` once emitted.
# Keep fallback JS in page.tsx until wired.

def grid_score(n: Nat) -> Nat:
  0n

def hall_heat(count: Nat) -> Nat:
  Nat.mul(count, 2n)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Bend emit ok — grid_score and hall_heat ready for JS import")
