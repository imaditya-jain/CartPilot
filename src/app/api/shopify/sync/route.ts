import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { syncStoreSchema } from "@/lib/validation/shopify";
import { requireOwnedStore } from "@/services/store-service";
import { runStoreSync } from "@/services/shopify-sync-service";
import { ok, fail, handleApiError, ApiError } from "@/lib/utils/api-response";
import { Store } from "@/models/Store";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const { storeId } = syncStoreSchema.parse(await request.json());

    const store = await requireOwnedStore(storeId, auth.userId);

    if (store.connectionStatus !== "connected") {
      throw new ApiError(409, "STORE_NOT_CONNECTED", "Connect this store to Shopify before syncing.");
    }
    if (store.syncStatus === "syncing") {
      return fail(409, "SYNC_IN_PROGRESS", "A sync is already running for this store.");
    }

    // Set syncStatus synchronously so a client polling GET /api/stores immediately after this
    // response sees "syncing" rather than racing the background task's own first write.
    await Store.updateOne({ _id: storeId }, { $set: { syncStatus: "syncing", lastSyncError: null } });

    // Fire-and-forget: the route responds immediately; the client polls GET /api/stores for
    // syncStatus/lastSyncedAt/lastSyncError to observe progress and completion.
    void runStoreSync(storeId, auth.userId);

    return ok({ started: true });
  } catch (error) {
    return handleApiError(error);
  }
}
