import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { shopDomainSchema } from "@/lib/validation/shopify";
import { verifyOAuthHmac } from "@/lib/shopify/hmac";
import { verifyAndConsumeOAuthState } from "@/lib/shopify/oauth-state";
import { exchangeCodeForAccessToken, fetchShopInfo } from "@/services/shopify-oauth-service";
import { finalizeStoreConnection } from "@/services/shopify-connection-service";

export const dynamic = "force-dynamic";

/**
 * Redirects relative to the incoming request's own origin rather than a configured app URL, so
 * this works correctly regardless of which port the server actually bound to — unlike
 * SHOPIFY_APP_URL (used to build the redirect_uri Shopify itself calls back to), nothing here
 * requires a value known in advance.
 */
function redirectToStores(request: NextRequest, status: "connected" | "error", message?: string) {
  const url = new URL("/stores", request.url);
  url.searchParams.set("shopify", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shopParam = searchParams.get("shop");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const auth = await getAuthContext();
  if (!auth) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/stores");
    return NextResponse.redirect(loginUrl);
  }

  if (!shopParam || !code || !state) {
    return redirectToStores(request, "error", "Missing required OAuth parameters.");
  }

  const shopResult = shopDomainSchema.safeParse(shopParam);
  if (!shopResult.success) {
    return redirectToStores(request, "error", "Invalid shop domain.");
  }
  const shop = shopResult.data;

  const hmacValid = await verifyOAuthHmac(searchParams);
  if (!hmacValid) {
    return redirectToStores(request, "error", "Request signature verification failed.");
  }

  const stateValid = verifyAndConsumeOAuthState(state, shop);
  if (!stateValid) {
    return redirectToStores(request, "error", "OAuth state mismatch — please try connecting again.");
  }

  try {
    const { accessToken, scopes } = await exchangeCodeForAccessToken(shop, code);
    const shopInfo = await fetchShopInfo(shop, accessToken);

    await finalizeStoreConnection({
      tenantId: auth.userId,
      shopDomain: shop,
      accessToken,
      shopifyShopId: shopInfo.id,
      shopName: shopInfo.name,
      scopes,
    });

    return redirectToStores(request, "connected");
  } catch (error) {
    console.error("Shopify OAuth callback failed:", error);
    return redirectToStores(request, "error", "Failed to complete the Shopify connection.");
  }
}
