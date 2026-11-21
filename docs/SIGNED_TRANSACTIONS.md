# Physicoin signed transactions v1

This is an additive testnet migration. Existing session-authorized transfers remain unchanged until a wallet UI can generate and protect keys safely.

## Key and address

- Algorithm: Ed25519.
- `senderPublicKey`: base64 of an SPKI DER public key.
- Address: lowercase SHA-256 hex of the exact DER bytes.
- Private keys are generated and kept by the wallet client. They are never sent to Physicoin servers.

## Amounts

Consensus data never uses JavaScript floating point. `amountMinor` and `feeMinor` are base-10 strings containing non-negative integers. The protocol must freeze the number of minor units per PHY before signed transfers become authoritative.

## Replay protection

A transaction commits to:

- protocol version;
- chain ID;
- sender public key;
- recipient address;
- amount and fee;
- sender nonce;
- memo;
- expiry time.

Nodes reject a reused `(senderAddress, nonce)`, a nonce other than the sender's next expected nonce, an expired transaction, invalid signatures, and insufficient balances.

## Canonical bytes

`lib/blockchain/canonical.ts` is the initial executable specification. It uses a fixed magic/version prefix followed by length-prefixed UTF-8 fields in a fixed order. JSON serialization is forbidden for consensus signing because property order and number representation can diverge.

## Safe rollout

1. Add the database migration.
2. Add deterministic test vectors shared by browser, Node, and the future standalone node.
3. Build client-side key generation, encrypted backup, and recovery UX.
4. Add a transaction submission endpoint that verifies before persistence.
5. Run signed and legacy transfers side-by-side on testnet.
6. Disable legacy spending only after existing users have migrated.

Do not attach real monetary value during this migration.
