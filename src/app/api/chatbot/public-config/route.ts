import { NextRequest } from "next/server";
import { getPublicChatbotConfig } from "@/services/chatbot-config-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated endpoint the storefront widget calls to load its own appearance and
 * behavior settings. Deliberately returns only display/behavior fields (see
 * getPublicChatbotConfig) — never tenant IDs, internal store state, or anything else from the
 * merchant's account.
 */
export async function GET(request: NextRequest) {
  try {
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");
    }

    const config = await getPublicChatbotConfig(storeId);
    if (!config) {
      return fail(404, "CHATBOT_NOT_PUBLISHED", "Publish this store's chatbot before loading it on the storefront.");
    }

    return ok(config);
  } catch (error) {
    return handleApiError(error);
  }
}
