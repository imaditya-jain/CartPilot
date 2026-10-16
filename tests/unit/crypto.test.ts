import { describe, expect, it } from "vitest";
import { generateRandomToken, sha256Hex, timingSafeEqual } from "@/lib/auth/crypto";

describe("generateRandomToken", () => {
  it("generates distinct tokens on each call", () => {
    const a = generateRandomToken();
    const b = generateRandomToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("sha256Hex", () => {
  it("is deterministic for the same input", async () => {
    const a = await sha256Hex("hello world");
    const b = await sha256Hex("hello world");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await sha256Hex("hello world");
    const b = await sha256Hex("hello world!");
    expect(a).not.toBe(b);
  });
});

describe("timingSafeEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
