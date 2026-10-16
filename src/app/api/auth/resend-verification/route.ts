import { NextRequest } from "next/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestVerificationEmail } from "@/services/auth-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`resend-verification:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.success) {
      return fail(429, "RATE_LIMITED", "Too many requests. Please try again later.");
    }

    const body = await request.json();
    const { email } = await forgotPasswordSchema.validate(body, { abortEarly: true, stripUnknown: true });
    await requestVerificationEmail(email, request.nextUrl.origin);

    return ok({ message: "If an unverified account exists for this email, we've sent a new verification link." });
  } catch (error) {
    return handleApiError(error);
  }
}
