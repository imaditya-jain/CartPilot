import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export interface OrderLineItem {
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  title: string;
  quantity: number;
  price: number;
}

export interface OrderDocument extends Document {
  tenantId: Types.ObjectId;
  storeId: Types.ObjectId;
  shopifyOrderId: string;
  name: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: Date | null;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  currency: string;
  subtotalPrice: number;
  totalDiscounts: number;
  totalPrice: number;
  lineItems: OrderLineItem[];
  shopifyCreatedAt: Date;
  shopifyUpdatedAt: Date;
  syncedAt: Date;
}

const lineItemSchema = new Schema<OrderLineItem>(
  {
    shopifyProductId: { type: String, default: null },
    shopifyVariantId: { type: String, default: null },
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema<OrderDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    shopifyOrderId: { type: String, required: true },
    name: { type: String, required: true },
    financialStatus: { type: String, default: null },
    fulfillmentStatus: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    customerId: { type: String, default: null },
    customerEmail: { type: String, default: null },
    customerName: { type: String, default: null },
    currency: { type: String, required: true },
    subtotalPrice: { type: Number, required: true, default: 0 },
    totalDiscounts: { type: Number, required: true, default: 0 },
    totalPrice: { type: Number, required: true, default: 0 },
    lineItems: { type: [lineItemSchema], default: [] },
    shopifyCreatedAt: { type: Date, required: true },
    shopifyUpdatedAt: { type: Date, required: true },
    syncedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

orderSchema.index({ storeId: 1, shopifyOrderId: 1 }, { unique: true });
orderSchema.index({ storeId: 1, shopifyCreatedAt: -1 });
orderSchema.index({ storeId: 1, customerId: 1 });

export const Order: Model<OrderDocument> = models.Order ?? model<OrderDocument>("Order", orderSchema);
