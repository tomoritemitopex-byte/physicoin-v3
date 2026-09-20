import Base

# Score — parallel Latin grid scorer (proxy for full row/col validation).
# Full Latin validator would fork row_conflicts vs col_conflicts vs pair-uniqueness
# in parallel via `r c = rows_score(cells,n) cols_score(cells,n)` and join with
# Nat/add, requiring explicit List duplication via dup_list (linear types).
# This keeps the proxy minimal but type-correct and verifiable:
# `a b = h latin_score(t, n)` evaluates head and tail concurrently on HVM/CUDA.
# Demonstrates Bend's fork-join: both branches run in parallel.
# Verifies with `bend --check-only bend/Score.bend`.

def latin_score(cells: List<Nat>, n: Nat) -> Nat:
  match cells:
    case Nil{}:
      0n
    case Con{h, t}:
      a b = h latin_score(t, n)
      Nat.add(a, b)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Score ready — latin_score: List<Nat>, Nat -> Nat via parallel bend (row/col proxy, sum)")
