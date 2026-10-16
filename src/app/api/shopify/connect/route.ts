import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { connectStoreSchema } from "@/lib/validation/shopify";
import { createOAuthState } from "@/lib/shopify/oauth-state";
import { buildAuthorizeUrl } from "@/services/shopify-oauth-service";
import { fail, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return fail(401, "UNAUTHENTICATED", "You must be signed in to connect a store.");
    }

    const parsed = connectStoreSchema.safeParse({ shop: request.nextUrl.searchParams.get("shop") });
    if (!parsed.success) {
      return fail(400, "INVALID_SHOP_DOMAIN", parsed.error.issues[0]?.message ?? "Invalid shop domain.");
    }

    const { shop } = parsed.data;
    const state = createOAuthState(shop);
    const authorizeUrl = buildAuthorizeUrl(shop, state);

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return handleApiError(error);
  }
}
