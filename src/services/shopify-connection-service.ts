import { encryptSecret } from "@/lib/shopify/crypto";
import { upsertConnectedStore } from "@/services/store-service";
import { registerStoreWebhooks } from "@/services/shopify-webhook-registration-service";
import { runStoreSync } from "@/services/shopify-sync-service";
import { Store, type StoreDocument } from "@/models/Store";

interface FinalizeConnectionInput {
  tenantId: string;
  shopDomain: string;
  accessToken: string;
  shopifyShopId: string | null;
  shopName: string | null;
  scopes: string[];
}

/**
 * The single place both connection paths (real OAuth callback and the local-dev access-token
 * path) converge: persist the store, register webhook subscriptions, and kick off an initial
 * sync — so a merchant never has to manually click "sync" after connecting, and product/order
 * changes start flowing in via webhook as soon as the store is connected.
 *
 * Webhook registration and the initial sync are both best-effort: a failure in either must never
 * undo the store connection that already succeeded, so both are isolated from the connection
 * result and only logged on failure.
 */
export async function finalizeStoreConnection(input: FinalizeConnectionInput): Promise<StoreDocument> {
  const encryptedAccessToken = await encryptSecret(input.accessToken);

  const store = await upsertConnectedStore({
    tenantId: input.tenantId,
    shopDomain: input.shopDomain,
    shopifyShopId: input.shopifyShopId,
    shopName: input.shopName,
    encryptedAccessToken,
    scopes: input.scopes,
  });

  registerStoreWebhooks(input.shopDomain, input.accessToken)
    .then((results) => {
      const failures = results.filter((r) => !r.ok);
      if (failures.length > 0) {
        console.error(`Webhook registration partially failed for ${input.shopDomain}:`, failures);
      }
    })
    .catch((error) => {
      console.error(`Webhook registration failed for ${input.shopDomain}:`, error);
    });

  const storeId = store._id.toString();
  await Store.updateOne({ _id: storeId }, { $set: { syncStatus: "syncing", lastSyncError: null } });
  void runStoreSync(storeId, input.tenantId);

  return store;
}
