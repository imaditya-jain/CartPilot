import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { redeemDiscountSchema } from "@/lib/validation/discount";
import { getActiveRuleById, recordRedemption } from "@/services/discount-rule-service";
import { getDecryptedAccessToken } from "@/services/shopify-sync-service";
import { createAdminClient } from "@/lib/shopify/admin-client";
import { createDiscountCode } from "@/services/shopify-discount-service";
import { ok, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

/**
 * Creates a real, redeemable Shopify discount code for one customer — a deliberate, merchant-
 * triggered action (clicking "Create discount code in Shopify" in the test panel), never
 * automatic, so testing never silently spams a connected store's Shopify Admin with codes.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const { storeId, ruleId, customerId } = redeemDiscountSchema.parse(await request.json());

    const rule = await getActiveRuleById(ruleId, storeId, auth.userId);
    const { store, accessToken } = await getDecryptedAccessToken(storeId);
    const client = createAdminClient(store.shopDomain, accessToken);

    const result = await createDiscountCode(client, rule, customerId);
    await recordRedemption(ruleId);

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
