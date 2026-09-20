import Base

# Derive — parallel grid derivation over nonces (conceptual Bend emit)
# Demonstrates parallel derive via Bend fork-join on List.
# Each nonce is mapped in parallel (bend `a b = f(h) g(t)`), stub derives
# nonce*2 to keep it minimal and type-correct; replace with real grid
# derivation (SHA256 + SplitMix64 + hill-climb) when wiring GPU/HVM path.
# Build via `bend build bend/Derive.bend -o /tmp/derive.js` (mirrored to bend/Derive.js).
# Verifies with `bend --check-only bend/Derive.bend`.

def derive_one(nonce: Nat) -> Nat:
  # Stub: nonce * 2 placeholder for real grid derivation (SHA256 + SplitMix64 + hill-climb)
  Nat.mul(nonce, 2n)

def derive_parallel(challenge: String, nonces: List<Nat>) -> List<Nat>:
  match nonces:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      # Parallel fork: derive head and tail concurrently via bend (HVM/CUDA).
      # `challenge` is threaded to the recursive branch; if derive_one needed
      # the challenge, make it `+challenge` (copyable) and use
      # `a b = derive_one(challenge, h) derive_parallel(challenge, t)`.
      a b = derive_one(h) derive_parallel(challenge, t)
      a <> b

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Derive ready — derive_parallel: String, List<Nat> -> List<Nat> via parallel bend (per-nonce grid stub)")
