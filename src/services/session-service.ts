import { Types } from "mongoose";
import { Session, type SessionDocument } from "@/models/Session";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/tokens";
import { generateRandomToken, sha256Hex, timingSafeEqual } from "@/lib/auth/crypto";
import { getServerEnv } from "@/lib/env";

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/** Creates a brand-new session lineage (used at login) and returns the token pair. */
export async function createSession(
  userId: string,
  email: string,
  meta: SessionMeta
): Promise<IssuedTokens> {
  const env = getServerEnv();
  const familyId = generateRandomToken(16);
  return issueSessionInFamily(userId, email, familyId, env.REFRESH_TOKEN_TTL_DAYS, meta);
}

async function issueSessionInFamily(
  userId: string,
  email: string,
  familyId: string,
  ttlDays: number,
  meta: SessionMeta
): Promise<IssuedTokens> {
  const sessionId = new Types.ObjectId();
  const refreshToken = await signRefreshToken(userId, sessionId.toString(), familyId, ttlDays);
  const refreshTokenHash = await sha256Hex(refreshToken);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await Session.create({
    _id: sessionId,
    userId,
    refreshTokenHash,
    familyId,
    expiresAt,
    revokedAt: null,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  const accessToken = await signAccessToken(userId, email);
  return { accessToken, refreshToken };
}

export class RefreshTokenReuseError extends Error {
  constructor() {
    super("Refresh token reuse detected; session family revoked.");
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super("Invalid or expired refresh token.");
  }
}

/**
 * Rotates a refresh token: validates the presented token against the stored hash, detects
 * replay of an already-rotated token (revoking the whole session family when it happens), and
 * issues a fresh access/refresh pair tied to a new session document in the same family.
 */
export async function rotateRefreshToken(
  rawRefreshToken: string,
  email: string,
  meta: SessionMeta
): Promise<IssuedTokens> {
  const payload = await verifyRefreshToken(rawRefreshToken);
  if (!payload) throw new InvalidRefreshTokenError();

  const session = await Session.findById(payload.sessionId);
  if (!session) throw new InvalidRefreshTokenError();

  const presentedHash = await sha256Hex(rawRefreshToken);

  if (session.revokedAt) {
    // The session this token points to was already rotated away (or explicitly revoked).
    // Presenting it again means the token leaked — kill the entire lineage.
    await revokeSessionFamily(session.userId.toString(), session.familyId);
    throw new RefreshTokenReuseError();
  }

  if (!timingSafeEqual(session.refreshTokenHash, presentedHash)) {
    throw new InvalidRefreshTokenError();
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new InvalidRefreshTokenError();
  }

  session.revokedAt = new Date();
  await session.save();

  const env = getServerEnv();
  return issueSessionInFamily(
    payload.sub,
    email,
    session.familyId,
    env.REFRESH_TOKEN_TTL_DAYS,
    meta
  );
}

export async function revokeSessionFamily(userId: string, familyId: string): Promise<void> {
  await Session.updateMany(
    { userId, familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await Session.updateOne({ _id: sessionId }, { $set: { revokedAt: new Date() } });
}

/** Revokes every active session for a user — used on password reset, since a reset should log
 * out all other devices/sessions rather than leaving them valid under the old credential. */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function getSessionIdFromRefreshToken(
  rawRefreshToken: string
): Promise<{ sessionId: string } | null> {
  const payload = await verifyRefreshToken(rawRefreshToken);
  if (!payload) return null;
  return { sessionId: payload.sessionId };
}

export type { SessionDocument };
