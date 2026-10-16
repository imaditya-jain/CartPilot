import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { discountRuleSchema } from "@/lib/validation/discount";
import { updateRule, deleteRule } from "@/services/discount-rule-service";
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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthContext();
    const input = discountRuleSchema.parse(await request.json());

    const rule = await updateRule(params.id, input, auth.userId);
    return ok(serialize(rule));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthContext();
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");
    }

    await deleteRule(params.id, storeId, auth.userId);
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
