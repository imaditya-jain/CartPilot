import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export type AiAuditOperation = "chat_reply" | "chat_retrieval" | "knowledge_index" | "ai_insight";
export type AiAuditStatus = "success" | "error" | "not_configured";

export interface AiAuditMessage {
  role: string;
  content: string;
}

export interface AiAuditDocument extends Document {
  tenantId: Types.ObjectId;
  storeId: Types.ObjectId;
  operation: AiAuditOperation;
  model: string;
  generationConfig: { temperature: number; maxTokens: number; enableThinking: boolean };
  status: AiAuditStatus;
  inputMessages: AiAuditMessage[];
  output: string | null;
  errorMessage: string | null;
  providerStatus: number | null;
  durationMs: number;
  createdAt: Date;
}

const messageSchema = new Schema<AiAuditMessage>(
  { role: { type: String, required: true }, content: { type: String, required: true } },
  { _id: false }
);

const schema = new Schema<AiAuditDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    operation: { type: String, enum: ["chat_reply", "chat_retrieval", "knowledge_index", "ai_insight"], required: true },
    model: { type: String, required: true },
    generationConfig: {
      temperature: { type: Number, required: true },
      maxTokens: { type: Number, required: true },
      enableThinking: { type: Boolean, required: true },
    },
    status: { type: String, enum: ["success", "error", "not_configured"], required: true },
    inputMessages: { type: [messageSchema], default: [] },
    output: { type: String, default: null },
    errorMessage: { type: String, default: null },
    providerStatus: { type: Number, default: null },
    durationMs: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ tenantId: 1, storeId: 1, createdAt: -1, _id: -1 });

export const AiAudit: Model<AiAuditDocument> = models.AiAudit ?? model<AiAuditDocument>("AiAudit", schema);
