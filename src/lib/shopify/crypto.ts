import { getServerEnv } from "@/lib/env";

/**
 * Encrypts/decrypts Shopify access tokens at rest using AES-256-GCM via Web Crypto, so the same
 * code works in both the Node and Edge runtimes. The key is derived once (SHA-256 of
 * TOKEN_ENCRYPTION_KEY) rather than requiring the env var itself to be exactly 32 bytes.
 */

let cachedKey: CryptoKey | null = null;

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const env = getServerEnv();
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY)
  );
  cachedKey = await crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// Returns a plain ArrayBuffer (not a typed-array view) so it satisfies WebCrypto's
// BufferSource type regardless of how @types/node's Uint8Array<TArrayBuffer> default
// parameter interacts with lib.dom's typings in a given TypeScript version.
function fromBase64(value: string): ArrayBuffer {
  const buffer = Buffer.from(value, "base64");
  const bytes = new Uint8Array(buffer.length);
  bytes.set(buffer);
  return bytes.buffer;
}

/** Returns `${ivBase64}.${ciphertextBase64}` — the IV is not secret and must travel with the ciphertext. */
export async function encryptSecret(plainText: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText)
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(encrypted: string): Promise<string> {
  const [ivPart, ciphertextPart] = encrypted.split(".");
  if (!ivPart || !ciphertextPart) {
    throw new Error("Malformed encrypted value.");
  }
  const key = await getEncryptionKey();
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    key,
    fromBase64(ciphertextPart)
  );
  return new TextDecoder().decode(plainBuffer);
}
