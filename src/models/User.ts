import { Schema, model, models, type Document, type Model } from "mongoose";

export interface UserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ["active", "disabled"], required: true, default: "active" },
  },
  { timestamps: true }
);

export const User: Model<UserDocument> = models.User ?? model<UserDocument>("User", userSchema);
