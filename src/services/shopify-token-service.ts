import { getServerEnv } from "@/lib/env";
import type { ShopifyOfflineToken } from "@/services/shopify-oauth-service";

interface ShopifyTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

function toTokenSet(body: ShopifyTokenResponse): ShopifyOfflineToken {
  if (!body.access_token || !body.refresh_token || !body.expires_in || !body.refresh_token_expires_in) {
    throw new Error("Shopify did not return a complete expiring offline token pair.");
  }

  const now = Date.now();
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    accessTokenExpiresAt: new Date(now + body.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + body.refresh_token_expires_in * 1000),
  };
}

async function postTokenRequest(shopDomain: string, params: URLSearchParams): Promise<ShopifyOfflineToken> {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const body = await response.json().catch(() => ({})) as ShopifyTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    throw new Error(body.error_description ?? body.error ?? `Shopify token endpoint returned ${response.status}.`);
  }
  return toTokenSet(body);
}

function getCredentials() {
  const env = getServerEnv();
  if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_API_SECRET) {
    throw new Error("Shopify OAuth credentials are not configured.");
  }
  return { clientId: env.SHOPIFY_API_KEY, clientSecret: env.SHOPIFY_API_SECRET };
}

export async function refreshShopifyOfflineToken(
  shopDomain: string,
  refreshToken: string
): Promise<ShopifyOfflineToken> {
  const { clientId, clientSecret } = getCredentials();
  return postTokenRequest(shopDomain, new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  }));
}

/** Migrates a previously stored, permanent OAuth token to Shopify's expiring token pair. */
export async function migrateLegacyOfflineToken(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyOfflineToken> {
  const { clientId, clientSecret } = getCredentials();
  const tokenType = "urn:shopify:params:oauth:token-type:offline-access-token";
  return postTokenRequest(shopDomain, new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    client_id: clientId,
    client_secret: clientSecret,
    subject_token: accessToken,
    subject_token_type: tokenType,
    requested_token_type: tokenType,
    expiring: "1",
  }));
}
