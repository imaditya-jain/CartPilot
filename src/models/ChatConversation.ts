import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export interface ChatProductReference {
  shopifyProductId: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  url: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products: ChatProductReference[];
  createdAt: Date;
}

export interface ChatConversationDocument extends Document {
  tenantId: Types.ObjectId;
  storeId: Types.ObjectId;
  /** Anonymous, pseudonymous identifier generated client-side — never tied to a real identity. */
  visitorId: string;
  messages: ChatMessage[];
  lastMessageAt: Date;
  createdAt: Date;
}

const productRefSchema = new Schema<ChatProductReference>(
  {
    shopifyProductId: { type: String, required: true },
    title: { type: String, required: true },
    price: { type: Number, default: null },
    imageUrl: { type: String, default: null },
    url: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new Schema<ChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 2000 },
    products: { type: [productRefSchema], default: [] },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false }
);

const schema = new Schema<ChatConversationDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    visitorId: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ storeId: 1, visitorId: 1 });
// Data minimization: conversations auto-expire 30 days after the last message.
schema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const ChatConversation: Model<ChatConversationDocument> =
  models.ChatConversation ?? model<ChatConversationDocument>("ChatConversation", schema);
