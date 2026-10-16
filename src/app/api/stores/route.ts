import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { listStoresForTenant } from "@/services/store-service";
import { ok, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    const stores = await listStoresForTenant(auth.userId);

    return ok({
      stores: stores.map((store) => ({
        id: store._id.toString(),
        shopDomain: store.shopDomain,
        connectionStatus: store.connectionStatus,
        syncStatus: store.syncStatus,
        lastSyncedAt: store.lastSyncedAt,
        lastSyncError: store.lastSyncError,
        productCount: store.productCount,
        orderCount: store.orderCount,
        lastWidgetPingAt: store.lastWidgetPingAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
