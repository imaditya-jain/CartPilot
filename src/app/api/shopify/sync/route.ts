import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { syncStoreSchema } from "@/lib/validation/shopify";
import { requireOwnedStore } from "@/services/store-service";
import { runStoreSync } from "@/services/shopify-sync-service";
import { ok, fail, handleApiError, ApiError } from "@/lib/utils/api-response";
import { Store } from "@/models/Store";

export const maxDuration = 300;
const STALE_SYNC_AFTER_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const { storeId } = syncStoreSchema.parse(await request.json());

    const store = await requireOwnedStore(storeId, auth.userId);

    if (store.connectionStatus !== "connected") {
      throw new ApiError(409, "STORE_NOT_CONNECTED", "Connect this store to Shopify before syncing.");
    }
    if (
      store.syncStatus === "syncing" &&
      store.syncStartedAt &&
      Date.now() - store.syncStartedAt.getTime() < STALE_SYNC_AFTER_MS
    ) {
      return fail(409, "SYNC_IN_PROGRESS", "A sync is already running for this store.");
    }

    // Keep the function alive until all Shopify pages have been fetched and written. Detached
    // work can be terminated as soon as a serverless route sends its response.
    await Store.updateOne(
      { _id: storeId },
      { $set: { syncStatus: "syncing", syncStartedAt: new Date(), lastSyncError: null } }
    );
    await runStoreSync(storeId, auth.userId);

    const completedStore = await Store.findById(storeId).select("syncStatus lastSyncError");
    if (completedStore?.syncStatus === "error") {
      throw new ApiError(502, "SHOPIFY_SYNC_FAILED", completedStore.lastSyncError ?? "Shopify sync failed.");
    }

    return ok({ started: true, completed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
