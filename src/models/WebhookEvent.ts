import { Schema, model, models, type Document, type Model } from "mongoose";

export interface WebhookEventDocument extends Document {
  shopifyWebhookId: string;
  topic: string;
  shopDomain: string;
  receivedAt: Date;
}

const schema = new Schema<WebhookEventDocument>(
  {
    shopifyWebhookId: { type: String, required: true, unique: true },
    topic: { type: String, required: true },
    shopDomain: { type: String, required: true },
    receivedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false }
);

// Retain dedup records for 30 days — comfortably longer than Shopify's webhook retry window.
schema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const WebhookEvent: Model<WebhookEventDocument> =
  models.WebhookEvent ?? model<WebhookEventDocument>("WebhookEvent", schema);
