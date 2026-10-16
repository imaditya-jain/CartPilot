import { NextRequest } from "next/server";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { verifyEmail } from "@/services/auth-service";
import { ok, handleApiError } from "@/lib/utils/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = await verifyEmailSchema.validate(body, { abortEarly: true, stripUnknown: true });
    await verifyEmail(token);
    return ok({ verified: true });
  } catch (error) {
    return handleApiError(error);
  }
}
