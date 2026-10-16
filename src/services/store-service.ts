import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Store, type StoreDocument } from "@/models/Store";
import { ApiError } from "@/lib/utils/api-response";

/**
 * The single chokepoint for tenant isolation: every API route and service that operates on a
 * specific store MUST resolve it through this function rather than `Store.findById`. It is the
 * only place that is allowed to trust a client-supplied store ID, because it always re-checks
 * ownership against the authenticated tenant before returning anything.
 */
export async function requireOwnedStore(storeId: string, tenantId: string): Promise<StoreDocument> {
  if (!Types.ObjectId.isValid(storeId)) {
    throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  }

  await connectToDatabase();
  const store = await Store.findOne({ _id: storeId, tenantId });

  if (!store) {
    // Same error whether the store doesn't exist or belongs to another tenant — never reveal
    // which, so a tenant can't probe for the existence of other tenants' store IDs.
    throw new ApiError(404, "STORE_NOT_FOUND", "Store not found.");
  }

  return store;
}

export async function listStoresForTenant(tenantId: string) {
  await connectToDatabase();
  return Store.find({ tenantId }).sort({ createdAt: -1 });
}

/** Cross-tenant: used only by the scheduled daily reconciliation sync, never by a user-facing route. */
export async function listAllConnectedStores(): Promise<StoreDocument[]> {
  await connectToDatabase();
  return Store.find({ connectionStatus: "connected" });
}

/**
 * Webhooks arrive keyed by shop domain, not our internal store ID. Multiple tenant rows for the
 * same domain shouldn't normally exist (one Shopify store installs the app once), but the schema
 * doesn't forbid it, so this returns all matches defensively rather than assuming exactly one.
 */
export async function findConnectedStoresByDomain(shopDomain: string) {
  await connectToDatabase();
  return Store.find({ shopDomain, connectionStatus: "connected" });
}

interface UpsertConnectedStoreInput {
  tenantId: string;
  shopDomain: string;
  shopifyShopId: string | null;
  shopName: string | null;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  tokenType: "oauth_offline" | "custom";
  scopes: string[];
}

/** Idempotent: re-running OAuth for an already-connected store just refreshes its credentials. */
export async function upsertConnectedStore(input: UpsertConnectedStoreInput): Promise<StoreDocument> {
  await connectToDatabase();
  const store = await Store.findOneAndUpdate(
    { tenantId: input.tenantId, shopDomain: input.shopDomain },
    {
      $set: {
        shopifyShopId: input.shopifyShopId,
        shopName: input.shopName,
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        tokenType: input.tokenType,
        scopes: input.scopes,
        connectionStatus: "connected",
        lastSyncError: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return store;
}

export async function disconnectStore(storeId: string, tenantId: string): Promise<void> {
  await requireOwnedStore(storeId, tenantId);
  await Store.updateOne(
    { _id: storeId, tenantId },
    {
      $set: {
        connectionStatus: "disconnected",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
      },
    }
  );
}
