import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookHmac } from "@/lib/shopify/hmac";
import { connectToDatabase } from "@/lib/mongodb";
import { WebhookEvent } from "@/models/WebhookEvent";
import { findConnectedStoresByDomain } from "@/services/store-service";
import {
  handleAppUninstalledWebhook,
  handleOrderWebhook,
  handleProductDeleteWebhook,
  handleProductWebhook,
} from "@/services/shopify-webhook-service";
import { scheduleStoreKnowledgeRebuild } from "@/services/chatbot-knowledge-service";

export const dynamic = "force-dynamic";

const ORDER_TOPICS = new Set(["orders/create", "orders/updated", "orders/paid", "orders/cancelled"]);
const PRODUCT_UPSERT_TOPICS = new Set(["products/create", "products/update"]);

export async function POST(request: NextRequest) {
  // Must read the raw text body for HMAC verification before any JSON parsing — parsing and
  // re-serializing can change byte-for-byte equality and break the signature check.
  const rawBody = await request.text();

  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  const isValid = await verifyWebhookHmac(rawBody, hmacHeader);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic");
  const shopDomain = request.headers.get("x-shopify-shop-domain");
  const webhookId = request.headers.get("x-shopify-webhook-id");

  if (!topic || !shopDomain || !webhookId) {
    return NextResponse.json({ error: "Missing required Shopify webhook headers." }, { status: 400 });
  }

  await connectToDatabase();

  // Idempotency: Shopify retries webhooks that don't get a fast 2xx, and may redeliver the same
  // event. The unique index on shopifyWebhookId makes this insert the atomic dedup check —
  // a duplicate-key error means we've already processed this exact delivery.
  try {
    await WebhookEvent.create({ shopifyWebhookId: webhookId, topic, shopDomain });
  } catch (error) {
    const isDuplicateKey = (error as { code?: number }).code === 11000;
    if (isDuplicateKey) {
      return NextResponse.json({ received: true, deduplicated: true });
    }
    throw error;
  }

  try {
    const stores = await findConnectedStoresByDomain(shopDomain);

    if (topic === "app/uninstalled") {
      await handleAppUninstalledWebhook(shopDomain);
    } else if (stores.length > 0) {
      const payload = JSON.parse(rawBody);
      for (const store of stores) {
        if (PRODUCT_UPSERT_TOPICS.has(topic)) {
          await handleProductWebhook(store, payload);
        } else if (topic === "products/delete") {
          await handleProductDeleteWebhook(store, payload);
        } else if (ORDER_TOPICS.has(topic)) {
          await handleOrderWebhook(store, payload);
        }
        if (PRODUCT_UPSERT_TOPICS.has(topic) || topic === "products/delete" || ORDER_TOPICS.has(topic)) {
          scheduleStoreKnowledgeRebuild(store._id.toString());
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Failed to process Shopify webhook (topic=${topic}, shop=${shopDomain}):`, error);
    // Still acknowledge receipt: we've recorded the webhook ID, so a retry would be deduplicated
    // anyway and never get a second chance to process. Surfacing a 500 here would just cause
    // Shopify to retry into the same dedup wall. The failure is logged for investigation.
    return NextResponse.json({ received: true, processingError: true });
  }
}
