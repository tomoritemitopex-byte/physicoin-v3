# Physicoin protocol specification

Status: draft 0.1

This document will become the source of truth for independently implemented Physicoin nodes. Fields and encodings marked TBD are not consensus-safe and must not be deployed as a production network.

## Design rules

1. Consensus objects use a deterministic canonical encoding.
2. Hashes and signatures operate on domain-separated bytes.
3. Nodes derive balances only by replaying finalized blocks from genesis.
4. Web sessions never authorize protocol transactions.
5. Unknown protocol versions and algorithms are rejected.

## Network identity

- Network name: Physicoin V3 testnet
- Network ID: `physicoin-v3-testnet`
- Genesis hash: TBD
- Protocol version: `1`

## Hash representation

- Algorithm: TBD after compatibility review
- Wire representation: lowercase hexadecimal
- Byte order: network order

## Wallet identity

A protocol wallet is identified by a public signing key, not by a mutable profile ID.

```text
WalletAddress {
  network_id
  signature_algorithm
  public_key
  checksum
}
```

Exact canonical encoding: TBD.

## Transaction

```text
TransactionV1 {
  version
  network_id
  sender_public_key
  sender_sequence
  recipient_address
  amount_atomic
  fee_atomic
  valid_until_height
  memo_hash
  signature_algorithm
  signature
}
```

Unsigned transaction bytes must exclude `signature`. The signature must cover a domain separator plus the canonical unsigned bytes.

Validation invariants:

- version and network ID are supported;
- amount and fee are non-negative integers within protocol bounds;
- sender sequence is exactly the next expected sequence;
- sender has sufficient finalized balance;
- validity height has not expired;
- recipient encoding and checksum are valid;
- signature verifies over canonical unsigned bytes;
- transaction hash has not already been finalized.

## Block

```text
BlockHeaderV1 {
  version
  network_id
  height
  previous_block_hash
  timestamp
  transaction_root
  state_root
  proof_root
  proposer_public_key
  consensus_round
}

SignedBlockV1 {
  header
  transactions
  proofs
  proposer_signature_algorithm
  proposer_signature
  finality_certificate
}
```

A node must reject a block unless:

- height is parent height plus one;
- previous hash names the locally validated parent;
- timestamp satisfies documented bounds;
- all roots recompute exactly;
- every transaction and proof validates;
- replay produces the committed state root;
- proposer is eligible under the consensus rule;
- proposer signature and finality certificate verify.

## Genesis

Genesis must be a committed static file containing:

- network ID;
- initial validator public keys;
- initial balances, if any;
- monetary parameters;
- consensus parameters;
- protocol activation height; and
- genesis timestamp.

No node may silently generate genesis at startup.

## Monetary units

- Display symbol: PHY
- Atomic unit name and decimal precision: TBD
- Initial supply: TBD
- Issuance schedule: TBD
- Maximum supply, if any: TBD

These values require an explicit governance decision before genesis is pinned.

## Consensus

Current round mining is an application-level competition. Production consensus and fork choice remain TBD.

Before implementation, the project must specify:

- validator admission and removal;
- proposer selection;
- vote format;
- quorum threshold;
- equivocation evidence;
- finality rule;
- fork-choice rule;
- offline-validator behavior; and
- validator key rotation.

## Peer protocol

Minimum messages:

```text
Status
GetBlocks
Blocks
NewBlock
NewTransaction
GetPeers
Peers
```

Every message must have explicit size limits, protocol versioning, and validation before allocation or persistence.

## Cryptographic agility

Every address, signature, and consensus key includes an algorithm identifier. Algorithm activation and retirement require a versioned network upgrade with a fixed activation height.

Post-quantum algorithms are not enabled merely by naming the project quantum-ready. They require compatible libraries, test vectors, performance limits, migration rules, and independent review.

## Open decisions

- Canonical encoding format
- Hash algorithm
- Classical signature algorithm
- Optional post-quantum signature algorithm
- Consensus/finality design
- Atomic precision and issuance
- Genesis validator set
- Network transport
