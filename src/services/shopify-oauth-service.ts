import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/shopify/admin-client";
import { ApiError } from "@/lib/utils/api-response";

export function buildAuthorizeUrl(shopDomain: string, state: string): string {
  const env = getServerEnv();
  if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_APP_URL) {
    throw new ApiError(503, "SHOPIFY_NOT_CONFIGURED", "Shopify integration is not configured on this server.");
  }

  const redirectUri = new URL("/api/shopify/callback", env.SHOPIFY_APP_URL).toString();
  const params = new URLSearchParams({
    client_id: env.SHOPIFY_API_KEY,
    scope: env.SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

export interface ShopifyOfflineToken {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

interface AccessTokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/** Exchanges an OAuth authorization code for a refreshable expiring offline token pair. */
export async function exchangeCodeForAccessToken(
  shopDomain: string,
  code: string
): Promise<ShopifyOfflineToken & { scopes: string[] }> {
  const env = getServerEnv();
  if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_API_SECRET) {
    throw new ApiError(503, "SHOPIFY_NOT_CONFIGURED", "Shopify integration is not configured on this server.");
  }

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
      expiring: "1",
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error_description?: string; error?: string };
    throw new ApiError(
      502,
      "SHOPIFY_TOKEN_EXCHANGE_FAILED",
      body.error_description ?? body.error ?? "Failed to complete Shopify authorization."
    );
  }

  const body = (await response.json()) as AccessTokenResponse;
  if (!body.access_token || !body.refresh_token || !body.expires_in || !body.refresh_token_expires_in) {
    throw new ApiError(502, "SHOPIFY_EXPIRING_TOKEN_MISSING", "Shopify did not return expiring offline token credentials.");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    accessTokenExpiresAt: new Date(Date.now() + body.expires_in * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + body.refresh_token_expires_in * 1000),
    scopes: body.scope.split(",").map((s) => s.trim()),
  };
}

interface ShopInfoResponse {
  shop: { id: string; name: string };
}

export async function fetchShopInfo(shopDomain: string, accessToken: string) {
  const client = createAdminClient(shopDomain, accessToken);
  const data = await client.request<ShopInfoResponse>(`query { shop { id name } }`);
  return data.shop;
}
