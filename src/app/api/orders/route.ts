import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { listOrdersForStore } from "@/services/order-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const params = request.nextUrl.searchParams;
    const storeId = params.get("storeId");
    if (!storeId) {
      return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");
    }

    const page = Number.parseInt(params.get("page") ?? "1", 10) || 1;
    const pageSize = Number.parseInt(params.get("pageSize") ?? "25", 10) || 25;

    const result = await listOrdersForStore(storeId, auth.userId, page, pageSize);

    return ok({
      ...result,
      items: result.items.map((order) => ({
        id: order._id.toString(),
        name: order.name,
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        currency: order.currency,
        totalPrice: order.totalPrice,
        cancelledAt: order.cancelledAt,
        shopifyCreatedAt: order.shopifyCreatedAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
