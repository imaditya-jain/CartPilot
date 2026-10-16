import { z } from "zod";

export const discountRuleSchema = z
  .object({
    storeId: z.string().min(1, "storeId is required"),
    name: z.string().trim().min(1, "Name is required").max(60, "Name is too long"),
    triggerType: z.enum(["first_time_customer", "returning_customer", "min_lifetime_spend", "cart_contains_tag"]),
    minOrderCount: z.coerce.number().int().min(1).optional(),
    minLifetimeSpend: z.coerce.number().min(0).optional(),
    tag: z.string().trim().min(1).max(40).optional(),
    discountType: z.enum(["percentage", "fixed_amount"]),
    discountValue: z.coerce.number().positive("Discount value must be greater than zero"),
    appliesOncePerCustomer: z.boolean(),
    active: z.boolean(),
  })
  .refine((rule) => rule.triggerType !== "returning_customer" || rule.minOrderCount !== undefined, {
    message: "minOrderCount is required for a returning-customer rule",
    path: ["minOrderCount"],
  })
  .refine((rule) => rule.triggerType !== "min_lifetime_spend" || rule.minLifetimeSpend !== undefined, {
    message: "minLifetimeSpend is required for a min-lifetime-spend rule",
    path: ["minLifetimeSpend"],
  })
  .refine((rule) => rule.triggerType !== "cart_contains_tag" || rule.tag !== undefined, {
    message: "tag is required for a cart-contains-tag rule",
    path: ["tag"],
  })
  .refine((rule) => rule.discountType !== "percentage" || rule.discountValue <= 100, {
    message: "A percentage discount can't exceed 100",
    path: ["discountValue"],
  });
export type DiscountRuleInput = z.infer<typeof discountRuleSchema>;

export const redeemDiscountSchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
  ruleId: z.string().min(1, "ruleId is required"),
  customerId: z.string().min(1, "customerId is required"),
});
export type RedeemDiscountInput = z.infer<typeof redeemDiscountSchema>;
