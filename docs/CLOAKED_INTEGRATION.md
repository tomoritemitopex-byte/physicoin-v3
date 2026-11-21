# Cloaked Physicoin integration

## Decision

`physicoin-v3` is the protocol and blockchain repository. `physicoin` (Cloaked Physicoin) is the product/application repository. They form one ecosystem but keep separate deployments during the security migration.

This avoids copying two Next.js root applications into one directory, colliding API routes, migrations, authentication systems and CSS, or making a one-step production cutover that could corrupt balances.

## Implemented bridge

- `lib/cloaked/client.ts`: server-side service discovery and health client.
- `/api/ecosystem/cloaked/health`: same-origin status endpoint for the V3 UI.
- `/app/ecosystem`: combined product surface and link to the Cloaked application.
- `CLOAKED_PHYSICOIN_URL`: private server-side origin override.

## Integration contract

Cloaked must never write V3 chain tables directly. It submits canonical signed transactions to a versioned V3 endpoint. V3 verifies signature, chain ID, nonce, expiry, amount, balance and transaction ID before admission to its mempool. Cloaked reads balances and confirmations from versioned, read-only V3 endpoints.

## Migration sequence

1. Deploy the bridge and verify both services are reachable.
2. Complete signed-transaction vectors and submission API in V3.
3. Add a client-side wallet to Cloaked; private keys never enter either server.
4. Add V3 read APIs for account state, transactions, blocks and fee policy.
5. Replace Cloaked database balance mutations with signed V3 submissions.
6. Reconcile every migrated account and freeze legacy balance writes.
7. Only then consider moving selected Cloaked pages into this repository.

## Deployment

Set `CLOAKED_PHYSICOIN_URL` in the V3 Vercel project. The current public default is `<scrubbed-url-domain>. Do not put secrets in `NEXT_PUBLIC_*` variables.
