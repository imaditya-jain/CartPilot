import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export interface ProductVariant {
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
}

export interface ProductDocument extends Document {
  tenantId: Types.ObjectId;
  storeId: Types.ObjectId;
  shopifyProductId: string;
  title: string;
  handle: string;
  description: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  variants: ProductVariant[];
  imageUrls: string[];
  shopifyUpdatedAt: Date;
  syncedAt: Date;
}

const variantSchema = new Schema<ProductVariant>(
  {
    shopifyVariantId: { type: String, required: true },
    title: { type: String, required: true },
    sku: { type: String, default: null },
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: null },
    inventoryQuantity: { type: Number, default: null },
  },
  { _id: false }
);

const productSchema = new Schema<ProductDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    shopifyProductId: { type: String, required: true },
    title: { type: String, required: true },
    handle: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "active" },
    vendor: { type: String, default: "" },
    productType: { type: String, default: "" },
    tags: { type: [String], default: [] },
    variants: { type: [variantSchema], default: [] },
    imageUrls: { type: [String], default: [] },
    shopifyUpdatedAt: { type: Date, required: true },
    syncedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

productSchema.index({ storeId: 1, shopifyProductId: 1 }, { unique: true });
productSchema.index({ storeId: 1, title: 1 });

export const Product: Model<ProductDocument> =
  models.Product ?? model<ProductDocument>("Product", productSchema);
