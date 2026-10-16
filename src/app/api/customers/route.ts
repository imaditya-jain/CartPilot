import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { listCustomersForStore } from "@/services/customer-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");
    }

    const customers = await listCustomersForStore(storeId, auth.userId);
    return ok(customers);
  } catch (error) {
    return handleApiError(error);
  }
}
