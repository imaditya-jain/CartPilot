import { NextRequest } from "next/server";
import { resetPasswordApiSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/services/auth-service";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.success) {
      return fail(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
    }

    const body = await request.json();
    const input = await resetPasswordApiSchema.validate(body, { abortEarly: true, stripUnknown: true });

    await resetPassword(input);
    clearAuthCookies();

    return ok({ reset: true });
  } catch (error) {
    return handleApiError(error);
  }
}
