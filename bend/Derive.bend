import Base

# Derive — parallel grid derivation over nonces (Bend-native fan-out).
# SHA256 + SplitMix64 + 1500-step hill-climb stay authoritative in TS
# (lib/proof-engine.ts: derive() is the source of truth; see its header).
# Bend owns deterministic per-nonce mixing + parallel fan-out on HVM/CUDA:
# each nonce is mixed with the challenge via an LCG (pure Nat mul/add/mod,
# no byte ops) and mapped in parallel `a b = f(h) g(t)`.
# Challenge contributes via String.length (bytes need SHA256, which stays TS-side).
# Verifies with `bend --check-only bend/Derive.bend`.

def lcg_step(state: Nat) -> Nat:
  Nat.mod(Nat.add(Nat.mul(1664525n, state), 1013904223n), Nat.pow(2n, 32n))

def mix_seed(+challenge: String, nonce: Nat) -> Nat:
  Nat.add(String.length(challenge), nonce)

def derive_one(+challenge: String, nonce: Nat) -> Nat:
  s0 = mix_seed(challenge, nonce)
  s1 = lcg_step(s0)
  s2 = lcg_step(s1)
  lcg_step(s2)

def derive_parallel(+challenge: String, nonces: List<Nat>) -> List<Nat>:
  match nonces:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      a b = derive_one(challenge, h) derive_parallel(challenge, t)
      a <> b

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print("Derive ready — derive_parallel: String, List<Nat> -> List<Nat> via LCG + parallel bend")
