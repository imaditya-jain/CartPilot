import { connectToDatabase } from "@/lib/mongodb";
import { User, type UserDocument } from "@/models/User";
import { EmailVerificationToken } from "@/models/EmailVerificationToken";
import { PasswordResetToken } from "@/models/PasswordResetToken";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateRandomToken, sha256Hex } from "@/lib/auth/crypto";
import { sendEmail } from "@/lib/email/mailer";
import { verificationEmailTemplate, passwordResetEmailTemplate } from "@/lib/email/templates";
import {
  createSession,
  revokeAllSessionsForUser,
  type IssuedTokens,
  type SessionMeta,
} from "@/services/session-service";
import { ApiError } from "@/lib/utils/api-response";
import type { RegisterInput, LoginInput, ResetPasswordApiInput } from "@/lib/validation/auth";

const VERIFICATION_TOKEN_TTL_HOURS = 24;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Always resolves without revealing whether the email already existed, to prevent account
 * enumeration through the registration endpoint. A real new account is only created, and a
 * verification email only sent, when the email is genuinely unused.
 */
export async function registerUser(input: RegisterInput, appOrigin: string): Promise<void> {
  await connectToDatabase();

  const existing = await User.findOne({ email: input.email }).select("_id").lean();
  if (existing) return;

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    emailVerified: false,
    status: "active",
  });

  await issueVerificationEmail(user, appOrigin);
}

async function issueVerificationEmail(user: UserDocument, appOrigin: string): Promise<void> {
  const rawToken = generateRandomToken(32);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await EmailVerificationToken.create({ userId: user._id, tokenHash, expiresAt });

  const verifyUrl = `${appOrigin}/verify-email?token=${rawToken}`;
  const { html, text } = verificationEmailTemplate(verifyUrl);
  await sendEmail({ to: user.email, subject: "Verify your CartPilot AI account", html, text });
}

/** Reissues a verification link without revealing whether an account exists. */
export async function requestVerificationEmail(email: string, appOrigin: string): Promise<void> {
  await connectToDatabase();

  const user = await User.findOne({ email, emailVerified: false });
  if (!user) return;

  // Only the newest outstanding link remains valid after a resend.
  await EmailVerificationToken.deleteMany({ userId: user._id, usedAt: null });
  await issueVerificationEmail(user, appOrigin);
}

export async function verifyEmail(rawToken: string): Promise<void> {
  await connectToDatabase();

  const tokenHash = await sha256Hex(rawToken);
  const record = await EmailVerificationToken.findOne({ tokenHash });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "INVALID_TOKEN", "This verification link is invalid or has expired.");
  }

  record.usedAt = new Date();
  await record.save();

  await User.updateOne({ _id: record.userId }, { $set: { emailVerified: true } });
}

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export async function loginUser(
  input: LoginInput,
  meta: SessionMeta
): Promise<IssuedTokens & { user: { id: string; name: string; email: string } }> {
  await connectToDatabase();

  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.status !== "active") {
    throw new ApiError(403, "ACCOUNT_DISABLED", "This account has been disabled.");
  }

  if (!user.emailVerified) {
    throw new ApiError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Please verify your email before logging in. Check your inbox for the verification link."
    );
  }

  const tokens = await createSession(user._id.toString(), user.email, meta);
  return { ...tokens, user: { id: user._id.toString(), name: user.name, email: user.email } };
}

export async function getUserById(userId: string) {
  await connectToDatabase();
  return User.findById(userId).select("name email emailVerified status");
}

/**
 * Always resolves without revealing whether the email exists, to prevent account enumeration
 * through the forgot-password endpoint. A reset token and email are only generated for an
 * account that genuinely exists and is active.
 */
export async function requestPasswordReset(email: string, appOrigin: string): Promise<void> {
  await connectToDatabase();

  const user = await User.findOne({ email, status: "active" }).select("_id email");
  if (!user) return;

  const rawToken = generateRandomToken(32);
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await PasswordResetToken.create({ userId: user._id, tokenHash, expiresAt });

  const resetUrl = `${appOrigin}/reset-password?token=${rawToken}`;
  const { html, text } = passwordResetEmailTemplate(resetUrl);
  await sendEmail({ to: user.email, subject: "Reset your CartPilot AI password", html, text });
}

const INVALID_RESET_TOKEN_MESSAGE = "This password reset link is invalid or has expired.";

/**
 * Resets the password for a valid, unexpired, unused reset token, then revokes every active
 * session for that account — a password reset should log out all devices, not just leave
 * existing refresh tokens (issued under the old, possibly-compromised password) valid.
 */
export async function resetPassword(input: ResetPasswordApiInput): Promise<void> {
  await connectToDatabase();

  const tokenHash = await sha256Hex(input.token);
  const record = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "INVALID_TOKEN", INVALID_RESET_TOKEN_MESSAGE);
  }

  const passwordHash = await hashPassword(input.password);

  record.usedAt = new Date();
  await record.save();

  await User.updateOne({ _id: record.userId }, { $set: { passwordHash } });
  await revokeAllSessionsForUser(record.userId.toString());
}
