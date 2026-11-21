# Physicoin V3 blockchain architecture audit

Status: practice-stage review. Do not attach real monetary value yet.

## What exists today

Physicoin V3 has a Next.js API, PostgreSQL persistence, a Rust proof engine, mining rounds, server-side proof verification, wallet sessions, and a consensus feed.

## Current trust model

The deployed Vercel API and its configured PostgreSQL database are the coordinating authority. Miners independently compute proofs, but the server decides which submissions are accepted and the database holds canonical state.

This is a useful centralized test network. It is not yet an independently replicated blockchain because the repository does not currently define a complete peer-to-peer node protocol, deterministic block format, node synchronization protocol, fork-choice rule, or independently signed block production.

## Immediate security findings

### P0: wallet enrollment takeover window

A wallet with no password can be enrolled by the first caller who knows its user ID. Until ownership is proven cryptographically, wallet IDs must not control assets with real value.

Required fix:

1. Generate a client-side signing keypair.
2. Store only the public key and address on the server.
3. Require a signed server nonce to enroll or recover a wallet.
4. Never treat knowledge of a database user ID as ownership.

### P0: centralized canonical state

The PostgreSQL database is the canonical ledger. Database administrators or compromised application credentials can alter state.

Required fix:

1. Define canonical transaction and block serialization.
2. Hash every block header and transaction set deterministically.
3. Sign blocks with validator keys.
4. Replicate blocks across independent node operators.
5. Make every node replay and verify state from genesis.

### P1: consensus endpoint is observational

The API exposes a consensus feed, but independent nodes do not yet vote on, sign, exchange, and finalize blocks through a documented protocol.

### P1: server-generated sessions

HMAC sessions are acceptable for the web application, but they must not authorize blockchain transfers. Blockchain transfers should be authorized by wallet signatures over canonical transaction bytes.

### P1: binary provenance

A compiled proof binary is committed under `engine/`. Releases should be reproducibly built from the Rust source and accompanied by checksums and build metadata.

## Target architecture

```text
Wallet
  signs canonical transaction bytes
       |
       v
Any Physicoin node
  validates signature, nonce, balance, and fee
       |
       v
Peer-to-peer mempool
       |
       v
Validator proposes signed block
       |
       v
Other validators independently verify and finalize
       |
       v
Each node persists the same append-only block log and derived state

Vercel
  wallet UI + explorer + gateway only
```

## Protocol work order

1. Write `docs/PROTOCOL.md` with byte-level canonical formats and invariants.
2. Add wallet public keys, transaction signatures, sequence numbers, and replay protection.
3. Introduce blocks with height, previous hash, timestamp bounds, transaction root, state root, proposer key, and proposer signature.
4. Build a standalone long-running node process outside request-driven web routes.
5. Add peer discovery, block announcement, block download, and full sync from genesis.
6. Choose and document a finality and fork-choice mechanism.
7. Add deterministic replay tests and adversarial tests.
8. Keep Vercel as a replaceable explorer and API gateway.

## Definition of independent blockchain

Physicoin reaches the next milestone when three independently operated nodes can:

- start from the same pinned genesis specification;
- exchange signed transactions and blocks;
- reject invalid proofs, signatures, balances, and histories independently;
- converge on the same finalized chain under a documented consensus rule; and
- continue operating if the Vercel deployment and primary database are unavailable.

## Do not claim yet

Until those conditions are met, describe Physicoin V3 as an experimental centralized test network with independently computed mining proofs, not as a decentralized production blockchain.
