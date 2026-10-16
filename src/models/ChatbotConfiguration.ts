import { Schema, model, models, Types, type Document, type Model } from "mongoose";

export type ChatbotTone = "friendly" | "professional" | "concise" | "enthusiastic";
export type LauncherPosition = "bottom-right" | "bottom-left";
export type LauncherIcon = "message" | "sparkles" | "bot" | "shopping-bag" | "help-circle";
export type ChatbotThemeMode = "light" | "dark";

export interface ChatbotConfigurationDocument extends Document {
  tenantId: Types.ObjectId;
  storeId: Types.ObjectId;
  botName: string;
  welcomeMessage: string;
  tone: ChatbotTone;
  brandColor: string;
  textColor: string;
  themeMode: ChatbotThemeMode;
  launcherPosition: LauncherPosition;
  launcherIcon: LauncherIcon;
  panelWidth: number;
  panelHeight: number;
  suggestedPrompts: string[];
  productRecommendationsEnabled: boolean;
  offersEnabled: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ChatbotConfigurationDocument>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, unique: true },
    botName: { type: String, required: true, default: "CartPilot Assistant", maxlength: 40 },
    welcomeMessage: {
      type: String,
      required: true,
      default: "Hi! Looking for something specific, or want a recommendation?",
      maxlength: 280,
    },
    tone: {
      type: String,
      enum: ["friendly", "professional", "concise", "enthusiastic"],
      required: true,
      default: "friendly",
    },
    brandColor: { type: String, required: true, default: "#141413" },
    textColor: { type: String, required: true, default: "#FFFFFF" },
    themeMode: { type: String, enum: ["light", "dark"], required: true, default: "light" },
    launcherPosition: {
      type: String,
      enum: ["bottom-right", "bottom-left"],
      required: true,
      default: "bottom-right",
    },
    launcherIcon: {
      type: String,
      enum: ["message", "sparkles", "bot", "shopping-bag", "help-circle"],
      required: true,
      default: "message",
    },
    panelWidth: { type: Number, required: true, default: 380, min: 320, max: 480 },
    panelHeight: { type: Number, required: true, default: 560, min: 420, max: 720 },
    suggestedPrompts: { type: [String], default: ["What's new?", "Help me find a gift", "Track my order"] },
    productRecommendationsEnabled: { type: Boolean, required: true, default: true },
    offersEnabled: { type: Boolean, required: true, default: false },
    enabled: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

export const ChatbotConfiguration: Model<ChatbotConfigurationDocument> =
  models.ChatbotConfiguration ?? model<ChatbotConfigurationDocument>("ChatbotConfiguration", schema);
