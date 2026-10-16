import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export type StoreConnectionStatus = "pending" | "connected" | "disconnected" | "error";
export type StoreSyncStatus = "idle" | "syncing" | "error";

export interface StoreDocument extends Document {
  tenantId: Types.ObjectId;
  shopDomain: string;
  shopifyShopId: string | null;
  shopName: string | null;
  encryptedAccessToken: string | null;
  scopes: string[];
  connectionStatus: StoreConnectionStatus;
  syncStatus: StoreSyncStatus;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  productCount: number;
  orderCount: number;
  lastWidgetPingAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<StoreDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    shopDomain: { type: String, required: true, lowercase: true, trim: true },
    shopifyShopId: { type: String, default: null },
    shopName: { type: String, default: null },
    encryptedAccessToken: { type: String, default: null, select: false },
    scopes: { type: [String], default: [] },
    connectionStatus: {
      type: String,
      enum: ["pending", "connected", "disconnected", "error"],
      required: true,
      default: "pending",
    },
    syncStatus: {
      type: String,
      enum: ["idle", "syncing", "error"],
      required: true,
      default: "idle",
    },
    lastSyncedAt: { type: Date, default: null },
    lastSyncError: { type: String, default: null },
    productCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    lastWidgetPingAt: { type: Date, default: null },
  },
  { timestamps: true }
);

storeSchema.index({ tenantId: 1, shopDomain: 1 }, { unique: true });

export const Store: Model<StoreDocument> = models.Store ?? model<StoreDocument>("Store", storeSchema);
