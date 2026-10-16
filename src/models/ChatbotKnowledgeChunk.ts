import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export type ChatbotKnowledgeKind = "products" | "orders";

export interface ChatbotKnowledgeChunkDocument extends Document {
  storeId: Types.ObjectId;
  kind: ChatbotKnowledgeKind;
  batchIndex: number;
  contentHash: string;
  sourceData: string;
  summary: string;
  searchText: string;
  updatedAt: Date;
}

const schema = new Schema<ChatbotKnowledgeChunkDocument>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    kind: { type: String, enum: ["products", "orders"], required: true },
    batchIndex: { type: Number, required: true },
    contentHash: { type: String, required: true },
    sourceData: { type: String, required: true },
    summary: { type: String, required: true },
    searchText: { type: String, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

schema.index({ storeId: 1, kind: 1, batchIndex: 1 }, { unique: true });

export const ChatbotKnowledgeChunk: Model<ChatbotKnowledgeChunkDocument> =
  models.ChatbotKnowledgeChunk ?? model<ChatbotKnowledgeChunkDocument>("ChatbotKnowledgeChunk", schema);
