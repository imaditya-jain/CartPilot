import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export interface SessionDocument extends Document {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  /** Links rotated tokens in the same lineage so a reused-token replay revokes the whole chain. */
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<SessionDocument> =
  models.Session ?? model<SessionDocument>("Session", sessionSchema);
