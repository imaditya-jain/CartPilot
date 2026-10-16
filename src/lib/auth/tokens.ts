import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { getServerEnv } from "@/lib/env";

const ISSUER = "cartpilot-ai";
const AUDIENCE = "cartpilot-ai-app";
const ALGORITHM = "HS256";

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  email: string;
}

function getAccessSecret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().JWT_ACCESS_SECRET);
}

function getRefreshSecret(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().JWT_REFRESH_SECRET);
}

export async function signAccessToken(userId: string, email: string): Promise<string> {
  const env = getServerEnv();
  return new SignJWT({ email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(getAccessSecret());
}

/**
 * Verifies an access token's signature, issuer, audience, expiry, and algorithm.
 * Returns null instead of throwing so callers can treat any failure as "unauthenticated"
 * without needing to distinguish error types.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALGORITHM],
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  sessionId: string;
  familyId: string;
}

/**
 * The refresh JWT itself is opaque proof-of-possession; the session document (identified by
 * sessionId) holds the source of truth (hash, revocation, expiry) so a token can be revoked
 * server-side even though JWTs are normally stateless.
 */
export async function signRefreshToken(
  userId: string,
  sessionId: string,
  familyId: string,
  ttlDays: number
): Promise<string> {
  return new SignJWT({ sessionId, familyId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(getRefreshSecret());
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALGORITHM],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.familyId !== "string"
    ) {
      return null;
    }
    return payload as RefreshTokenPayload;
  } catch {
    return null;
  }
}
