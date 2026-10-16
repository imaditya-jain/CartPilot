import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import {
  REFRESH_TOKEN_COOKIE,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} from "@/lib/auth/cookies";
import { verifyRefreshToken } from "@/lib/auth/tokens";
import {
  rotateRefreshToken,
  InvalidRefreshTokenError,
  RefreshTokenReuseError,
} from "@/services/session-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";
import { getClientIp } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const rawRefreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;
    if (!rawRefreshToken) {
      return fail(401, "NO_SESSION", "No active session.");
    }

    const payload = await verifyRefreshToken(rawRefreshToken);
    if (!payload) {
      clearAuthCookies();
      return fail(401, "INVALID_SESSION", "Session expired. Please log in again.");
    }

    await connectToDatabase();
    const user = await User.findById(payload.sub).select("email");
    if (!user) {
      clearAuthCookies();
      return fail(401, "INVALID_SESSION", "Session expired. Please log in again.");
    }

    const tokens = await rotateRefreshToken(rawRefreshToken, user.email, {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: getClientIp(request),
    });

    setAccessTokenCookie(tokens.accessToken);
    setRefreshTokenCookie(tokens.refreshToken);

    return ok({ refreshed: true });
  } catch (error) {
    if (error instanceof RefreshTokenReuseError || error instanceof InvalidRefreshTokenError) {
      clearAuthCookies();
      return fail(401, "INVALID_SESSION", "Session expired. Please log in again.");
    }
    return handleApiError(error);
  }
}

export const runtime = "nodejs";
