import Base

# Lottery — lowest-wins selection (Bend spec, TS runtime).
# Doctrine from lib/proof-engine.ts: "Lottery (v1): eligibility + lowest
# ticket wins. Ticket = Argon2id over (challenge, nonce) — lowest wins the round."
# This is the parallel specification, verified via `bend --check-only`;
# TS (proof-engine.ts mineLottery + rounds.ts) is authoritative.
# Bend is the spec, not the runtime: `bend build` emits a runnable program,
# not an importable library. Empty-list sentinel is 0n (no tickets).
# Single-pass min fold — both head and tail conceptually evaluate in parallel
# via structural recursion; no List duplication needed.

def min_pick(c: Cmp, +a: Nat, +b: Nat) -> Nat:
  match c:
    case LT{}:
      a
    case EQ{}:
      a
    case GT{}:
      b

def min_of(+a: Nat, +b: Nat) -> Nat:
  min_pick(Nat.cmp(a, b), a, b)

def lottery_min(xs: List<Nat>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      match t:
        case Nil{}:
          h
        case Con{_t_head, _t_tail}:
          min_of(h, lottery_min(t))

def lottery(xs: List<Nat>) -> Nat:
  lottery_min(xs)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Lottery ready — lowest wins: List<Nat> -> Nat via min fold (TS: lowest ticket wins)")
