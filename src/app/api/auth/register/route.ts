import { NextRequest } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/services/auth-service";
import { ok, handleApiError, fail } from "@/lib/utils/api-response";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!limit.success) {
      return fail(429, "RATE_LIMITED", "Too many registration attempts. Please try again later.");
    }

    const body = await request.json();
    const input = await registerSchema.validate(body, { abortEarly: true, stripUnknown: true });

    await registerUser(input, request.nextUrl.origin);

    return ok({
      message: "If this email isn't already registered, check your inbox for a verification link.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
