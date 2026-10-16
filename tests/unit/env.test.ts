import { describe, expect, it } from "vitest";

const validBaseEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  MONGODB_URI: "mongodb://localhost:27017/test",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
  TOKEN_ENCRYPTION_KEY: "c".repeat(32),
};

describe("getServerEnv", () => {
  it("throws a readable, secret-free error when required vars are missing", async () => {
    vi.resetModules();
    process.env = { ...validBaseEnv, MONGODB_URI: "" } as NodeJS.ProcessEnv;
    const { getServerEnv } = await import("@/lib/env");
    expect(() => getServerEnv()).toThrow(/MONGODB_URI/);
  });

  it("parses successfully with all required vars present", async () => {
    vi.resetModules();
    process.env = { ...validBaseEnv } as NodeJS.ProcessEnv;
    const { getServerEnv } = await import("@/lib/env");
    const env = getServerEnv();
    expect(env.MONGODB_URI).toBe(validBaseEnv.MONGODB_URI);
  });
});

describe("integration readiness flags", () => {
  it("isShopifyConfigured is false unless all three Shopify vars are set", async () => {
    vi.resetModules();
    process.env = { ...validBaseEnv, SHOPIFY_API_KEY: "key" } as NodeJS.ProcessEnv;
    const { getServerEnv, isShopifyConfigured } = await import("@/lib/env");
    expect(isShopifyConfigured(getServerEnv())).toBe(false);
  });

  it("isShopifyConfigured is true once key, secret, and app URL are all set", async () => {
    vi.resetModules();
    process.env = {
      ...validBaseEnv,
      SHOPIFY_API_KEY: "key",
      SHOPIFY_API_SECRET: "secret",
      SHOPIFY_APP_URL: "http://localhost:3000",
    } as NodeJS.ProcessEnv;
    const { getServerEnv, isShopifyConfigured } = await import("@/lib/env");
    expect(isShopifyConfigured(getServerEnv())).toBe(true);
  });

  it("isAiConfigured and isEmailConfigured default to false when unset", async () => {
    vi.resetModules();
    process.env = { ...validBaseEnv } as NodeJS.ProcessEnv;
    const { getServerEnv, isAiConfigured, isEmailConfigured } = await import("@/lib/env");
    const env = getServerEnv();
    expect(isAiConfigured(env)).toBe(false);
    expect(isEmailConfigured(env)).toBe(false);
  });
});
