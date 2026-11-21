import { createHash, createPublicKey, verify } from "node:crypto";

export const CHAIN_ID = "physicoin-v3-testnet";
export const TX_VERSION = 1;

export type UnsignedTransaction = {
  version: 1;
  chainId: string;
  senderPublicKey: string;
  recipient: string;
  amountMinor: string;
  feeMinor: string;
  nonce: string;
  memo: string;
  expiresAt: string;
};

export type SignedTransaction = UnsignedTransaction & {
  signature: string;
};

const DECIMAL = /^(0|[1-9][0-9]*)$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function utf8(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function encodeField(value: string): Buffer {
  const bytes = utf8(value);
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

export function validateUnsignedTransaction(tx: UnsignedTransaction): string[] {
  const errors: string[] = [];
  if (tx.version !== TX_VERSION) errors.push("unsupported version");
  if (tx.chainId !== CHAIN_ID) errors.push("wrong chain id");
  if (!BASE64.test(tx.senderPublicKey)) errors.push("invalid sender public key encoding");
  if (!HEX_64.test(tx.recipient)) errors.push("invalid recipient address");
  if (!DECIMAL.test(tx.amountMinor) || BigInt(tx.amountMinor) <= 0n) errors.push("amount must be a positive integer");
  if (!DECIMAL.test(tx.feeMinor)) errors.push("fee must be a non-negative integer");
  if (!DECIMAL.test(tx.nonce)) errors.push("nonce must be a non-negative integer");
  if (!DECIMAL.test(tx.expiresAt)) errors.push("expiresAt must be unix milliseconds");
  if (utf8(tx.memo).length > 140) errors.push("memo exceeds 140 UTF-8 bytes");
  return errors;
}

/** Consensus-critical serialization. Never replace with JSON.stringify. */
export function serializeUnsignedTransaction(tx: UnsignedTransaction): Buffer {
  const errors = validateUnsignedTransaction(tx);
  if (errors.length) throw new Error(`INVALID_TRANSACTION: ${errors.join(", ")}`);
  return Buffer.concat([
    Buffer.from("PHYTX\u0001", "binary"),
    encodeField(tx.chainId),
    encodeField(tx.senderPublicKey),
    encodeField(tx.recipient),
    encodeField(tx.amountMinor),
    encodeField(tx.feeMinor),
    encodeField(tx.nonce),
    encodeField(tx.memo.normalize("NFC")),
    encodeField(tx.expiresAt),
  ]);
}

export function transactionId(tx: UnsignedTransaction): string {
  return createHash("sha256").update(serializeUnsignedTransaction(tx)).digest("hex");
}

/** Address = SHA-256 of the DER-encoded Ed25519 public key. */
export function addressFromPublicKey(publicKeyBase64: string): string {
  const der = Buffer.from(publicKeyBase64, "base64");
  return createHash("sha256").update(der).digest("hex");
}

export function verifySignedTransaction(tx: SignedTransaction): boolean {
  const { signature, ...unsigned } = tx;
  if (!BASE64.test(signature)) return false;
  try {
    const publicKeyDer = Buffer.from(unsigned.senderPublicKey, "base64");
    const publicKey = createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
    if (publicKey.asymmetricKeyType !== "ed25519") return false;
    return verify(null, serializeUnsignedTransaction(unsigned), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
