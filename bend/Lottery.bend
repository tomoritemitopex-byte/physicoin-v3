import Base

# Lottery — simple parallel lottery: each ticket maps in parallel
# Demonstrates Bend's parallel evaluation via `bend` (parallel let)
# Takes List Nat (tickets), returns List Nat (drawn winners)

def lottery_step(h: Nat) -> Nat:
  Nat.add(h, 1n)

def lottery(xs: List<Nat>) -> List<Nat>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      a b = lottery_step(h) lottery(t)
      a <> b

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Lottery ready — parallel draw: List Nat -> List Nat via bend")
