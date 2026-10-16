import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { discountRuleSchema } from "@/lib/validation/discount";
import { listRulesForStore, createRule } from "@/services/discount-rule-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";
import type { DiscountRuleDocument } from "@/models/DiscountRule";

export const dynamic = "force-dynamic";

function serialize(rule: DiscountRuleDocument) {
  return {
    id: rule._id.toString(),
    storeId: rule.storeId.toString(),
    name: rule.name,
    triggerType: rule.triggerType,
    minOrderCount: rule.minOrderCount,
    minLifetimeSpend: rule.minLifetimeSpend,
    tag: rule.tag,
    discountType: rule.discountType,
    discountValue: rule.discountValue,
    appliesOncePerCustomer: rule.appliesOncePerCustomer,
    active: rule.active,
    timesRedeemed: rule.timesRedeemed,
    lastRedeemedAt: rule.lastRedeemedAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");
    }

    const rules = await listRulesForStore(storeId, auth.userId);
    return ok(rules.map(serialize));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const input = discountRuleSchema.parse(await request.json());

    const rule = await createRule(input, auth.userId);
    return ok(serialize(rule), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
