import { describe, expect, it } from "vitest";
import { discountRuleSchema } from "@/lib/validation/discount";

const base = {
  storeId: "store_1",
  name: "Loyal customer",
  discountType: "percentage" as const,
  discountValue: 10,
  appliesOncePerCustomer: true,
  active: true,
};

describe("discountRuleSchema", () => {
  it("accepts a first-time-customer rule with no extra fields", () => {
    expect(() => discountRuleSchema.parse({ ...base, triggerType: "first_time_customer" })).not.toThrow();
  });

  it("rejects a returning-customer rule missing minOrderCount", () => {
    expect(() => discountRuleSchema.parse({ ...base, triggerType: "returning_customer" })).toThrow();
  });

  it("accepts a returning-customer rule with minOrderCount", () => {
    const result = discountRuleSchema.parse({
      ...base,
      triggerType: "returning_customer",
      minOrderCount: 2,
    });
    expect(result.minOrderCount).toBe(2);
  });

  it("rejects a min-lifetime-spend rule missing minLifetimeSpend", () => {
    expect(() => discountRuleSchema.parse({ ...base, triggerType: "min_lifetime_spend" })).toThrow();
  });

  it("rejects a cart-contains-tag rule missing tag", () => {
    expect(() => discountRuleSchema.parse({ ...base, triggerType: "cart_contains_tag" })).toThrow();
  });

  it("rejects a percentage discount over 100", () => {
    expect(() =>
      discountRuleSchema.parse({ ...base, triggerType: "first_time_customer", discountValue: 150 })
    ).toThrow();
  });

  it("accepts a fixed-amount discount over 100", () => {
    const result = discountRuleSchema.parse({
      ...base,
      triggerType: "first_time_customer",
      discountType: "fixed_amount",
      discountValue: 150,
    });
    expect(result.discountValue).toBe(150);
  });
});
