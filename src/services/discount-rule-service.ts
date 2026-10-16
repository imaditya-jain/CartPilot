import { connectToDatabase } from "@/lib/mongodb";
import { DiscountRule, type DiscountRuleDocument } from "@/models/DiscountRule";
import { requireOwnedStore } from "@/services/store-service";
import { ApiError } from "@/lib/utils/api-response";
import type { DiscountRuleInput } from "@/lib/validation/discount";

export async function listRulesForStore(storeId: string, tenantId: string): Promise<DiscountRuleDocument[]> {
  await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();
  return DiscountRule.find({ storeId }).sort({ createdAt: -1 });
}

export async function createRule(input: DiscountRuleInput, tenantId: string): Promise<DiscountRuleDocument> {
  const store = await requireOwnedStore(input.storeId, tenantId);
  await connectToDatabase();

  const { storeId, ...fields } = input;
  return DiscountRule.create({ ...fields, tenantId, storeId: store._id });
}

export async function updateRule(
  ruleId: string,
  input: DiscountRuleInput,
  tenantId: string
): Promise<DiscountRuleDocument> {
  const store = await requireOwnedStore(input.storeId, tenantId);
  await connectToDatabase();

  const { storeId, ...fields } = input;
  const rule = await DiscountRule.findOneAndUpdate(
    { _id: ruleId, storeId: store._id },
    { $set: fields },
    { new: true }
  );
  if (!rule) {
    throw new ApiError(404, "DISCOUNT_RULE_NOT_FOUND", "Discount rule not found.");
  }
  return rule;
}

export async function getActiveRuleById(
  ruleId: string,
  storeId: string,
  tenantId: string
): Promise<DiscountRuleDocument> {
  const store = await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();

  const rule = await DiscountRule.findOne({ _id: ruleId, storeId: store._id, active: true });
  if (!rule) {
    throw new ApiError(404, "DISCOUNT_RULE_NOT_FOUND", "Active discount rule not found.");
  }
  return rule;
}

export async function recordRedemption(ruleId: string): Promise<void> {
  await connectToDatabase();
  await DiscountRule.updateOne(
    { _id: ruleId },
    { $inc: { timesRedeemed: 1 }, $set: { lastRedeemedAt: new Date() } }
  );
}

export async function deleteRule(ruleId: string, storeId: string, tenantId: string): Promise<void> {
  const store = await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();

  const result = await DiscountRule.deleteOne({ _id: ruleId, storeId: store._id });
  if (result.deletedCount === 0) {
    throw new ApiError(404, "DISCOUNT_RULE_NOT_FOUND", "Discount rule not found.");
  }
}
