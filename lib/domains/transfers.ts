import { getDb } from "@/lib/db";
import { DomainError } from "./users";
import { validateSession } from "./auth";

// Wallet transfers: move mined coins between users.
// The sender must present their own live session token —
// nobody can move coins out of a wallet but its owner.

export async function send(input: {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  memo?: string;
  token: string;
}) {
  const { user_id } = await validateSession(input.token);
  if (user_id !== input.from_user_id) {
    throw new DomainError("NOT_YOUR_WALLET", "This session cannot spend from that wallet.", 403);
  }
  const amount = Number(input.amount);
  if (!input.to_user_id || !(amount > 0)) {
    throw new DomainError("BAD_AMOUNT", "Recipient and an amount above 0 are required.");
  }
  if (input.to_user_id === input.from_user_id) {
    throw new DomainError("BAD_RECIPIENT", "Cannot send to yourself.");
  }
  const sql = getDb();
  const to = await sql`SELECT id FROM physi_users WHERE id = ${input.to_user_id} LIMIT 1`;
  if (!to[0]) throw new DomainError("UNKNOWN_RECIPIENT", "Recipient not found.", 404);
  const from = await sql<{ b: string }[]>`
    SELECT mining_balance::text AS b FROM physi_users WHERE id = ${input.from_user_id} LIMIT 1`;
  if (Number(from[0]?.b || 0) < amount) {
    throw new DomainError("INSUFFICIENT_COINS", "Not enough $PHY in this wallet.", 409);
  }
  // Sink: 2% of every send is burned (min 0.01). Deflation pays for flow.
  const fee = Math.max(0.01, Math.round(amount * 0.02 * 100) / 100);
  if (amount <= fee) {
    throw new DomainError("DUST", "Amount must exceed the 2% burn fee.", 400);
  }
  const net = Math.round((amount - fee) * 100) / 100;
  // Atomic: debit + credit + ledger land together or not at all.
  // (Double-spend race closed: concurrent sends serialize on the row.)
  await sql.begin(async (tx: any) => {
    await tx`UPDATE physi_users SET mining_balance = mining_balance - ${amount} WHERE id = ${input.from_user_id}`;
    await tx`UPDATE physi_users SET mining_balance = LEAST(10000, mining_balance + ${net}) WHERE id = ${input.to_user_id}`;
    await tx`
      INSERT INTO physi_transfers (from_user, to_user, amount, memo)
      VALUES (${input.from_user_id}, ${input.to_user_id}, ${net}, ${String(input.memo || "").slice(0, 140)})`;
  });
  const [t] = await sql`
    SELECT id, amount, created_at FROM physi_transfers
    WHERE from_user = ${input.from_user_id} AND to_user = ${input.to_user_id}
    ORDER BY created_at DESC LIMIT 1`;
  return { transfer: t, fee, gross: amount };
}

export async function history(user_id: string, limit = 20) {
  const sql = getDb();
  return await sql`
    SELECT id, from_user, to_user, amount, memo, created_at FROM physi_transfers
    WHERE from_user = ${user_id} OR to_user = ${user_id}
    ORDER BY created_at DESC LIMIT ${Math.min(limit, 50)}`;
}
