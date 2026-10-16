import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export type DiscountRuleTriggerType =
  | "first_time_customer"
  | "returning_customer"
  | "min_lifetime_spend"
  | "cart_contains_tag";
export type DiscountType = "percentage" | "fixed_amount";

export interface DiscountRuleDocument extends Document {
  tenantId: Types.ObjectId;
  storeId: Types.ObjectId;
  name: string;
  triggerType: DiscountRuleTriggerType;
  minOrderCount: number | null;
  minLifetimeSpend: number | null;
  tag: string | null;
  discountType: DiscountType;
  discountValue: number;
  appliesOncePerCustomer: boolean;
  active: boolean;
  timesRedeemed: number;
  lastRedeemedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<DiscountRuleDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    triggerType: {
      type: String,
      enum: ["first_time_customer", "returning_customer", "min_lifetime_spend", "cart_contains_tag"],
      required: true,
    },
    minOrderCount: { type: Number, default: null },
    minLifetimeSpend: { type: Number, default: null },
    tag: { type: String, default: null },
    discountType: { type: String, enum: ["percentage", "fixed_amount"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    appliesOncePerCustomer: { type: Boolean, required: true, default: true },
    active: { type: Boolean, required: true, default: true },
    timesRedeemed: { type: Number, required: true, default: 0 },
    lastRedeemedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ storeId: 1, active: 1 });

export const DiscountRule: Model<DiscountRuleDocument> =
  models.DiscountRule ?? model<DiscountRuleDocument>("DiscountRule", schema);
