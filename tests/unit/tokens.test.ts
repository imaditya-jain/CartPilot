import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubEnv("NODE_ENV", "test");
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.MONGODB_URI = "mongodb://localhost:27017/test";
  process.env.JWT_ACCESS_SECRET = "test_access_secret_0123456789_0123456789";
  process.env.JWT_REFRESH_SECRET = "test_refresh_secret_0123456789_0123456789";
  process.env.TOKEN_ENCRYPTION_KEY = "test_encryption_key_0123456789_0123456789";
});

describe("access tokens", () => {
  it("round-trips a valid access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("@/lib/auth/tokens");
    const token = await signAccessToken("user-123", "user@example.com");
    const payload = await verifyAccessToken(token);
    expect(payload?.sub).toBe("user-123");
    expect(payload?.email).toBe("user@example.com");
  });

  it("rejects a token signed with the wrong secret", async () => {
    const { verifyAccessToken } = await import("@/lib/auth/tokens");
    const { SignJWT } = await import("jose");
    const forged = await new SignJWT({ email: "attacker@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuer("cartpilot-ai")
      .setAudience("cartpilot-ai-app")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode("wrong_secret_0123456789_0123456789_0123456789"));

    const payload = await verifyAccessToken(forged);
    expect(payload).toBeNull();
  });

  it("rejects an expired token", async () => {
    const { verifyAccessToken } = await import("@/lib/auth/tokens");
    const { SignJWT } = await import("jose");
    const expired = await new SignJWT({ email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuer("cartpilot-ai")
      .setAudience("cartpilot-ai-app")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!));

    const payload = await verifyAccessToken(expired);
    expect(payload).toBeNull();
  });

  it("rejects a token with the wrong audience", async () => {
    const { verifyAccessToken } = await import("@/lib/auth/tokens");
    const { SignJWT } = await import("jose");
    const wrongAudience = await new SignJWT({ email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuer("cartpilot-ai")
      .setAudience("some-other-app")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!));

    const payload = await verifyAccessToken(wrongAudience);
    expect(payload).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("round-trips a valid refresh token", async () => {
    const { signRefreshToken, verifyRefreshToken } = await import("@/lib/auth/tokens");
    const token = await signRefreshToken("user-123", "session-abc", "family-xyz", 7);
    const payload = await verifyRefreshToken(token);
    expect(payload?.sub).toBe("user-123");
    expect(payload?.sessionId).toBe("session-abc");
    expect(payload?.familyId).toBe("family-xyz");
  });

  it("access and refresh secrets are independent — a refresh token fails access verification", async () => {
    const { signRefreshToken, verifyAccessToken } = await import("@/lib/auth/tokens");
    const refreshToken = await signRefreshToken("user-123", "session-abc", "family-xyz", 7);
    const payload = await verifyAccessToken(refreshToken);
    expect(payload).toBeNull();
  });
});
