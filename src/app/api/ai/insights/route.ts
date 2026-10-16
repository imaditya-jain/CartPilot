import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { getOrGenerateInsight } from "@/services/ai-insights-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";
import { rateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");
    }

    const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
    if (forceRefresh) {
      const limit = rateLimit(`ai-insights-refresh:${auth.userId}`, 5, 60 * 60 * 1000);
      if (!limit.success) {
        return fail(429, "RATE_LIMITED", "Too many refresh requests. Please try again later.");
      }
    }

    const result = await getOrGenerateInsight(storeId, auth.userId, forceRefresh);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
