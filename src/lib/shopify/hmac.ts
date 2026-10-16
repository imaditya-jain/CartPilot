import { getServerEnv } from "@/lib/env";
import { timingSafeEqual } from "@/lib/auth/crypto";

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Buffer.from(new Uint8Array(signature)).toString("base64");
}

/**
 * Verifies the `hmac` query parameter Shopify attaches to OAuth install/callback requests.
 * Per Shopify's spec: remove `hmac` and `signature`, sort remaining params by key, join as
 * `key=value` pairs with `&`, then compare an HMAC-SHA256 hex digest of that string (using the
 * app's client secret) against the provided `hmac` value.
 */
export async function verifyOAuthHmac(searchParams: URLSearchParams): Promise<boolean> {
  const env = getServerEnv();
  if (!env.SHOPIFY_API_SECRET) return false;

  const providedHmac = searchParams.get("hmac");
  if (!providedHmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key === "hmac" || key === "signature") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join("&");

  const computed = await hmacSha256Hex(env.SHOPIFY_API_SECRET, message);
  return timingSafeEqual(computed, providedHmac);
}

/**
 * Verifies the `X-Shopify-Hmac-Sha256` header on an incoming webhook: a base64 HMAC-SHA256 of
 * the *raw* request body using the app's client secret. The raw body must be read as text
 * before any JSON parsing — parsing and re-stringifying can change byte-for-byte equality.
 */
export async function verifyWebhookHmac(rawBody: string, providedHmacBase64: string | null): Promise<boolean> {
  const env = getServerEnv();
  if (!env.SHOPIFY_API_SECRET || !providedHmacBase64) return false;

  const computed = await hmacSha256Base64(env.SHOPIFY_API_SECRET, rawBody);
  return timingSafeEqual(computed, providedHmacBase64);
}
