import type { DiscountRuleTriggerType } from "@/models/DiscountRule";

export interface EvaluableRule {
  triggerType: DiscountRuleTriggerType;
  minOrderCount: number | null;
  minLifetimeSpend: number | null;
  tag: string | null;
  active: boolean;
}

export interface EvaluableProfile {
  orderCount: number;
  totalSpent: number;
}

/**
 * Pure, deterministic rule evaluation — the chatbot's "AI narrates, never decides" rule (see
 * generateReply in chatbot-message-service.ts) applies here too: whether a discount is offered
 * is always this plain comparison, never an LLM judgment call.
 */
export function evaluateRule(rule: EvaluableRule, profile: EvaluableProfile, suggestedTags: string[]): boolean {
  if (!rule.active) return false;

  switch (rule.triggerType) {
    case "first_time_customer":
      return profile.orderCount === 0;
    case "returning_customer":
      return rule.minOrderCount !== null && profile.orderCount >= rule.minOrderCount;
    case "min_lifetime_spend":
      return rule.minLifetimeSpend !== null && profile.totalSpent >= rule.minLifetimeSpend;
    case "cart_contains_tag":
      return rule.tag !== null && suggestedTags.includes(rule.tag);
    default:
      return false;
  }
}

/** Returns the first active rule (in the given order) that matches, or null if none do. */
export function findEligibleRule<T extends EvaluableRule>(
  rules: T[],
  profile: EvaluableProfile,
  suggestedTags: string[]
): T | null {
  return rules.find((rule) => evaluateRule(rule, profile, suggestedTags)) ?? null;
}
