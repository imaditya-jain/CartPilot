import { beforeAll, describe, expect, it, vi } from "vitest";

const SECRET = "test_shopify_secret";

beforeAll(() => {
  vi.stubEnv("NODE_ENV", "test");
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.MONGODB_URI = "mongodb://localhost:27017/test";
  process.env.JWT_ACCESS_SECRET = "a".repeat(32);
  process.env.JWT_REFRESH_SECRET = "b".repeat(32);
  process.env.TOKEN_ENCRYPTION_KEY = "c".repeat(32);
  process.env.SHOPIFY_API_SECRET = SECRET;
});

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Buffer.from(new Uint8Array(sig)).toString("base64");
}

describe("verifyOAuthHmac", () => {
  it("accepts a correctly signed query string", async () => {
    const { verifyOAuthHmac } = await import("@/lib/shopify/hmac");
    const params = new URLSearchParams({ shop: "test-shop.myshopify.com", code: "abc123", state: "nonce1" });
    const message = ["code=abc123", "shop=test-shop.myshopify.com", "state=nonce1"].join("&");
    const hmac = await hmacHex(SECRET, message);
    params.set("hmac", hmac);

    await expect(verifyOAuthHmac(params)).resolves.toBe(true);
  });

  it("rejects a tampered query string (e.g. shop swapped after signing)", async () => {
    const { verifyOAuthHmac } = await import("@/lib/shopify/hmac");
    const message = ["code=abc123", "shop=test-shop.myshopify.com", "state=nonce1"].join("&");
    const hmac = await hmacHex(SECRET, message);

    const tamperedParams = new URLSearchParams({
      shop: "attacker-shop.myshopify.com",
      code: "abc123",
      state: "nonce1",
      hmac,
    });

    await expect(verifyOAuthHmac(tamperedParams)).resolves.toBe(false);
  });

  it("rejects a missing hmac parameter", async () => {
    const { verifyOAuthHmac } = await import("@/lib/shopify/hmac");
    const params = new URLSearchParams({ shop: "test-shop.myshopify.com" });
    await expect(verifyOAuthHmac(params)).resolves.toBe(false);
  });
});

describe("verifyWebhookHmac", () => {
  it("accepts a correctly signed raw body", async () => {
    const { verifyWebhookHmac } = await import("@/lib/shopify/hmac");
    const rawBody = JSON.stringify({ id: 123, title: "Test Product" });
    const signature = await hmacBase64(SECRET, rawBody);

    await expect(verifyWebhookHmac(rawBody, signature)).resolves.toBe(true);
  });

  it("rejects a body that was modified after signing", async () => {
    const { verifyWebhookHmac } = await import("@/lib/shopify/hmac");
    const originalBody = JSON.stringify({ id: 123, title: "Test Product" });
    const signature = await hmacBase64(SECRET, originalBody);
    const tamperedBody = JSON.stringify({ id: 123, title: "Malicious Product" });

    await expect(verifyWebhookHmac(tamperedBody, signature)).resolves.toBe(false);
  });

  it("rejects a null/missing signature header", async () => {
    const { verifyWebhookHmac } = await import("@/lib/shopify/hmac");
    await expect(verifyWebhookHmac("{}", null)).resolves.toBe(false);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const { verifyWebhookHmac } = await import("@/lib/shopify/hmac");
    const rawBody = JSON.stringify({ id: 123 });
    const wrongSignature = await hmacBase64("wrong_secret", rawBody);
    await expect(verifyWebhookHmac(rawBody, wrongSignature)).resolves.toBe(false);
  });
});
