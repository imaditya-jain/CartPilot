import { describe, expect, it } from "vitest";
import { evaluateRule, findEligibleRule, type EvaluableRule } from "@/services/discount-eligibility-service";

function rule(overrides: Partial<EvaluableRule> = {}): EvaluableRule {
  return {
    triggerType: "first_time_customer",
    minOrderCount: null,
    minLifetimeSpend: null,
    tag: null,
    active: true,
    ...overrides,
  };
}

describe("evaluateRule", () => {
  it("matches first_time_customer only when the profile has zero prior orders", () => {
    expect(evaluateRule(rule({ triggerType: "first_time_customer" }), { orderCount: 0, totalSpent: 0 }, [])).toBe(true);
    expect(evaluateRule(rule({ triggerType: "first_time_customer" }), { orderCount: 1, totalSpent: 0 }, [])).toBe(false);
  });

  it("matches returning_customer once orderCount meets the threshold", () => {
    const r = rule({ triggerType: "returning_customer", minOrderCount: 3 });
    expect(evaluateRule(r, { orderCount: 2, totalSpent: 0 }, [])).toBe(false);
    expect(evaluateRule(r, { orderCount: 3, totalSpent: 0 }, [])).toBe(true);
    expect(evaluateRule(r, { orderCount: 10, totalSpent: 0 }, [])).toBe(true);
  });

  it("matches min_lifetime_spend once totalSpent meets the threshold", () => {
    const r = rule({ triggerType: "min_lifetime_spend", minLifetimeSpend: 100 });
    expect(evaluateRule(r, { orderCount: 1, totalSpent: 99.99 }, [])).toBe(false);
    expect(evaluateRule(r, { orderCount: 1, totalSpent: 100 }, [])).toBe(true);
  });

  it("matches cart_contains_tag only when a suggested product carries the configured tag", () => {
    const r = rule({ triggerType: "cart_contains_tag", tag: "vip" });
    expect(evaluateRule(r, { orderCount: 1, totalSpent: 0 }, ["sale"])).toBe(false);
    expect(evaluateRule(r, { orderCount: 1, totalSpent: 0 }, ["vip", "sale"])).toBe(true);
  });

  it("never matches an inactive rule regardless of trigger conditions", () => {
    const r = rule({ triggerType: "first_time_customer", active: false });
    expect(evaluateRule(r, { orderCount: 0, totalSpent: 0 }, [])).toBe(false);
  });
});

describe("findEligibleRule", () => {
  it("returns the first matching active rule", () => {
    const rules = [
      rule({ triggerType: "min_lifetime_spend", minLifetimeSpend: 1000 }),
      rule({ triggerType: "returning_customer", minOrderCount: 2 }),
    ];
    const result = findEligibleRule(rules, { orderCount: 5, totalSpent: 10 }, []);
    expect(result).toBe(rules[1]);
  });

  it("returns null when no rule matches", () => {
    const rules = [rule({ triggerType: "returning_customer", minOrderCount: 5 })];
    expect(findEligibleRule(rules, { orderCount: 1, totalSpent: 0 }, [])).toBeNull();
  });
});
