import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/shopify/admin-client";
import { ApiError } from "@/lib/utils/api-response";

export function buildAuthorizeUrl(shopDomain: string, state: string): string {
  const env = getServerEnv();
  if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_APP_URL) {
    throw new ApiError(503, "SHOPIFY_NOT_CONFIGURED", "Shopify integration is not configured on this server.");
  }

  const redirectUri = `${env.SHOPIFY_APP_URL}/api/shopify/callback`;
  const params = new URLSearchParams({
    client_id: env.SHOPIFY_API_KEY,
    scope: env.SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

interface AccessTokenResponse {
  access_token: string;
  scope: string;
}

/** Exchanges a one-time OAuth authorization code for a permanent (offline) access token. */
export async function exchangeCodeForAccessToken(
  shopDomain: string,
  code: string
): Promise<{ accessToken: string; scopes: string[] }> {
  const env = getServerEnv();
  if (!env.SHOPIFY_API_KEY || !env.SHOPIFY_API_SECRET) {
    throw new ApiError(503, "SHOPIFY_NOT_CONFIGURED", "Shopify integration is not configured on this server.");
  }

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    throw new ApiError(502, "SHOPIFY_TOKEN_EXCHANGE_FAILED", "Failed to complete Shopify authorization.");
  }

  const body = (await response.json()) as AccessTokenResponse;
  return { accessToken: body.access_token, scopes: body.scope.split(",").map((s) => s.trim()) };
}

interface ShopInfoResponse {
  shop: { id: string; name: string };
}

export async function fetchShopInfo(shopDomain: string, accessToken: string) {
  const client = createAdminClient(shopDomain, accessToken);
  const data = await client.request<ShopInfoResponse>(`query { shop { id name } }`);
  return data.shop;
}
