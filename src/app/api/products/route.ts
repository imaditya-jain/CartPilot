import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { listProductsForStore } from "@/services/product-service";
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

    const result = await listProductsForStore(storeId, auth.userId, page, pageSize);

    return ok({
      ...result,
      items: result.items.map((product) => ({
        id: product._id.toString(),
        title: product.title,
        handle: product.handle,
        status: product.status,
        vendor: product.vendor,
        imageUrl: product.imageUrls[0] ?? null,
        minPrice: product.variants.length > 0 ? Math.min(...product.variants.map((v) => v.price)) : null,
        maxPrice: product.variants.length > 0 ? Math.max(...product.variants.map((v) => v.price)) : null,
        totalInventory: product.variants.reduce((sum, v) => sum + (v.inventoryQuantity ?? 0), 0),
        shopifyUpdatedAt: product.shopifyUpdatedAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
