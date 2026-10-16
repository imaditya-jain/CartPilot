import { NextRequest } from "next/server";
import { loginSchema } from "@/lib/validation/auth";
import { loginUser } from "@/services/auth-service";
import { setAccessTokenCookie, setRefreshTokenCookie } from "@/lib/auth/cookies";
import { ok, handleApiError, fail } from "@/lib/utils/api-response";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.success) {
      return fail(429, "RATE_LIMITED", "Too many login attempts. Please try again later.");
    }

    const body = await request.json();
    const input = await loginSchema.validate(body, { abortEarly: true, stripUnknown: true });

    const { accessToken, refreshToken, user } = await loginUser(input, {
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: ip,
    });

    setAccessTokenCookie(accessToken);
    setRefreshTokenCookie(refreshToken);

    return ok({ user });
  } catch (error) {
    return handleApiError(error);
  }
}
