import { describe, expect, it } from "vitest";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetPasswordApiSchema,
} from "@/lib/validation/auth";

describe("registerSchema", () => {
  it("accepts a valid registration payload", async () => {
    const result = await registerSchema.validate({
      name: "Jane Doe",
      email: "Jane@Example.com",
      password: "Sup3rSecret!",
    });
    expect(result.email).toBe("jane@example.com"); // lowercased
  });

  it("rejects a password missing an uppercase letter", async () => {
    await expect(
      registerSchema.validate({ name: "Jane", email: "jane@example.com", password: "lowercase123" })
    ).rejects.toThrow(/uppercase/);
  });

  it("rejects a password shorter than 10 characters", async () => {
    await expect(
      registerSchema.validate({ name: "Jane", email: "jane@example.com", password: "Sh0rt!" })
    ).rejects.toThrow(/at least 10 characters/);
  });

  it("rejects an invalid email", async () => {
    await expect(
      registerSchema.validate({ name: "Jane", email: "not-an-email", password: "Sup3rSecret!" })
    ).rejects.toThrow(/valid email/);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials and lowercases the email", async () => {
    const result = await loginSchema.validate({ email: "USER@Example.com", password: "anything" });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects a missing password", async () => {
    await expect(loginSchema.validate({ email: "user@example.com", password: "" })).rejects.toThrow(
      /Password is required/
    );
  });
});

describe("forgotPasswordSchema", () => {
  it("rejects an invalid email", async () => {
    await expect(forgotPasswordSchema.validate({ email: "nope" })).rejects.toThrow(/valid email/);
  });

  it("accepts a valid email", async () => {
    await expect(forgotPasswordSchema.validate({ email: "user@example.com" })).resolves.toBeTruthy();
  });
});

describe("resetPasswordSchema (client-side, includes confirmPassword)", () => {
  const base = { token: "abc123", password: "NewPassw0rd!" };

  it("accepts matching password and confirmPassword", async () => {
    await expect(
      resetPasswordSchema.validate({ ...base, confirmPassword: "NewPassw0rd!" })
    ).resolves.toBeTruthy();
  });

  it("rejects mismatched confirmPassword", async () => {
    await expect(
      resetPasswordSchema.validate({ ...base, confirmPassword: "Different1!" })
    ).rejects.toThrow(/Passwords must match/);
  });

  it("rejects a missing confirmPassword", async () => {
    await expect(resetPasswordSchema.validate({ ...base, confirmPassword: "" })).rejects.toThrow();
  });
});

describe("resetPasswordApiSchema (server-side, no confirmPassword)", () => {
  it("accepts token + password without confirmPassword", async () => {
    await expect(
      resetPasswordApiSchema.validate({ token: "abc123", password: "NewPassw0rd!" })
    ).resolves.toEqual({ token: "abc123", password: "NewPassw0rd!" });
  });

  it("rejects a weak password", async () => {
    await expect(resetPasswordApiSchema.validate({ token: "abc123", password: "weak" })).rejects.toThrow();
  });
});
