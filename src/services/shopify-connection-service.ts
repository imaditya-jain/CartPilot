import { encryptSecret } from "@/lib/shopify/crypto";
import { upsertConnectedStore } from "@/services/store-service";
import { registerStoreWebhooks } from "@/services/shopify-webhook-registration-service";
import type { StoreDocument } from "@/models/Store";
import type { ShopifyOfflineToken } from "@/services/shopify-oauth-service";

interface FinalizeConnectionInput {
  tenantId: string;
  shopDomain: string;
  accessToken: string;
  shopifyShopId: string | null;
  shopName: string | null;
  scopes: string[];
  offlineToken?: ShopifyOfflineToken;
  tokenType?: "oauth_offline" | "custom";
}

/**
 * The single place both connection paths (real OAuth callback and the local-dev access-token
 * path) converge: persist the store and register webhook subscriptions. The caller runs the
 * initial sync in its request so serverless runtimes keep it alive until it finishes.
 *
 * Webhook registration is best-effort and never undoes a connection that has already succeeded.
 */
export async function finalizeStoreConnection(input: FinalizeConnectionInput): Promise<StoreDocument> {
  const encryptedAccessToken = await encryptSecret(input.accessToken);
  const encryptedRefreshToken = input.offlineToken
    ? await encryptSecret(input.offlineToken.refreshToken)
    : null;

  const store = await upsertConnectedStore({
    tenantId: input.tenantId,
    shopDomain: input.shopDomain,
    shopifyShopId: input.shopifyShopId,
    shopName: input.shopName,
    encryptedAccessToken,
    encryptedRefreshToken,
    accessTokenExpiresAt: input.offlineToken?.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: input.offlineToken?.refreshTokenExpiresAt ?? null,
    tokenType: input.tokenType ?? (input.offlineToken ? "oauth_offline" : "custom"),
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

  return store;
}
