import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export interface EmailVerificationTokenDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const schema = new Schema<EmailVerificationTokenDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationToken: Model<EmailVerificationTokenDocument> =
  models.EmailVerificationToken ??
  model<EmailVerificationTokenDocument>("EmailVerificationToken", schema);
