import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { Store } from "@/models/Store";
import { ChatbotKnowledgeChunk, type ChatbotKnowledgeKind } from "@/models/ChatbotKnowledgeChunk";
import { callNvidiaChat } from "@/lib/ai/nvidia-client";

const SOURCE_BATCH_SIZE = 30;
const MAX_CONTEXT_CHUNKS = 2;
const STOPWORDS = new Set(["the", "and", "for", "are", "you", "your", "with", "that", "this", "what", "can", "could", "would", "about", "some", "please"]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type KnowledgeBatch = { kind: ChatbotKnowledgeKind; batchIndex: number; sourceData: string; contentHash: string };

function makeBatches(kind: ChatbotKnowledgeKind, rows: unknown[]): KnowledgeBatch[] {
  const batches: KnowledgeBatch[] = [];
  for (let offset = 0; offset < rows.length; offset += SOURCE_BATCH_SIZE) {
    const sourceData = JSON.stringify(rows.slice(offset, offset + SOURCE_BATCH_SIZE));
    batches.push({
      kind,
      batchIndex: Math.floor(offset / SOURCE_BATCH_SIZE),
      sourceData,
      contentHash: createHash("sha256").update(sourceData).digest("hex"),
    });
  }
  return batches;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

async function summarizeBatch(batch: KnowledgeBatch, tenantId: string, storeId: string): Promise<string> {
  const response = await callNvidiaChat(
    [
      {
        role: "system",
        content:
          "Create a compact factual knowledge note for a store shopping assistant from this batch of synchronized " +
          "Shopify data. Preserve exact product names, categories, prices, inventory, sales patterns, order statuses, " +
          "and dates when present. Do not infer missing facts. Do not repeat customer names, email addresses, " +
          "customer identifiers, or order identifiers in the summary; refer to customers only in aggregate. " +
          "Return plain text only.",
      },
      { role: "user", content: `Data type: ${batch.kind}\nBatch data:\n${batch.sourceData}` },
    ],
    {
      maxTokens: 900,
      audit: { tenantId, storeId, operation: "knowledge_index" },
    }
  );
  return response.trim();
}

function redactCustomerDetails(summary: string, batch: KnowledgeBatch): string {
  if (batch.kind !== "orders") return summary;
  const orders = JSON.parse(batch.sourceData) as Array<{ customerName?: string | null; customerEmail?: string | null }>;
  return orders.reduce((text, order) => {
    return [order.customerName, order.customerEmail]
      .filter((value): value is string => Boolean(value))
      .reduce((redacted, value) => redacted.replace(new RegExp(escapeRegex(value), "gi"), "[customer]") , text);
  }, summary);
}

/** Builds a persistent, privacy-filtered LLM index in batches and only re-summarizes changed batches. */
export async function rebuildStoreKnowledgeIndex(storeId: string): Promise<void> {
  await connectToDatabase();
  const storeObjectId = new Types.ObjectId(storeId);
  const store = await Store.findById(storeObjectId).select("tenantId").lean();
  if (!store) throw new Error("Store not found while building AI knowledge index.");

  const [products, orders, existing] = await Promise.all([
    Product.find({ storeId: storeObjectId }).sort({ _id: 1 }).lean(),
    Order.find({ storeId: storeObjectId }).sort({ _id: 1 }).lean(),
    ChatbotKnowledgeChunk.find({ storeId: storeObjectId }).lean(),
  ]);

  const productRows = products.map((product) => ({
    shopifyProductId: product.shopifyProductId,
    title: product.title,
    handle: product.handle,
    description: stripHtml(product.description),
    status: product.status,
    vendor: product.vendor,
    category: product.productType,
    tags: product.tags,
    imageUrls: product.imageUrls,
    variants: product.variants.map((variant) => ({
      shopifyVariantId: variant.shopifyVariantId,
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      inventoryQuantity: variant.inventoryQuantity,
    })),
  }));

  const orderRows = orders.map((order) => ({
    shopifyOrderId: order.shopifyOrderId,
    orderNumber: order.name,
    customerId: order.customerId,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    createdAt: order.shopifyCreatedAt,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    cancelled: Boolean(order.cancelledAt),
    currency: order.currency,
    subtotal: order.subtotalPrice,
    discounts: order.totalDiscounts,
    total: order.totalPrice,
    shopifyUpdatedAt: order.shopifyUpdatedAt,
    items: order.lineItems.map((item) => ({
      shopifyProductId: item.shopifyProductId,
      shopifyVariantId: item.shopifyVariantId,
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.price,
    })),
  }));

  const batches = [...makeBatches("products", productRows), ...makeBatches("orders", orderRows)];
  const oldByKey = new Map(existing.map((chunk) => [`${chunk.kind}:${chunk.batchIndex}`, chunk]));
  const generated: Array<{
    storeId: Types.ObjectId;
    kind: ChatbotKnowledgeKind;
    batchIndex: number;
    contentHash: string;
    sourceData: string;
    summary: string;
    searchText: string;
  }> = [];

  // Small concurrency keeps indexing practical without flooding the provider during a sync.
  for (let offset = 0; offset < batches.length; offset += 3) {
    const group = batches.slice(offset, offset + 3);
    const results = await Promise.all(
      group.map(async (batch) => {
        const previous = oldByKey.get(`${batch.kind}:${batch.batchIndex}`);
        const summary = previous?.contentHash === batch.contentHash
          ? previous.summary
          : redactCustomerDetails(await summarizeBatch(batch, store.tenantId.toString(), storeId), batch);
        return {
          storeId: storeObjectId,
          kind: batch.kind,
          batchIndex: batch.batchIndex,
          contentHash: batch.contentHash,
          sourceData: batch.sourceData,
          summary,
          searchText: `${summary}\n${batch.sourceData}`.toLowerCase(),
        };
      })
    );
    generated.push(...results);
  }

  if (generated.length > 0) await ChatbotKnowledgeChunk.bulkWrite(generated.map((chunk) => ({
    updateOne: {
      filter: { storeId: storeObjectId, kind: chunk.kind, batchIndex: chunk.batchIndex },
      update: { $set: chunk },
      upsert: true,
    },
  })), { ordered: true });
  if (generated.length === 0) {
    await ChatbotKnowledgeChunk.deleteMany({ storeId: storeObjectId });
  }

  const validKeys = new Set(generated.map((chunk) => `${chunk.kind}:${chunk.batchIndex}`));
  const staleIds = existing.filter((chunk) => !validKeys.has(`${chunk.kind}:${chunk.batchIndex}`)).map((chunk) => chunk._id);
  if (staleIds.length > 0) await ChatbotKnowledgeChunk.deleteMany({ _id: { $in: staleIds } });
}

/** Returns a few matching indexed batches; raw facts stay in Mongo until relevant to a shopper query. */
export async function getRelevantStoreKnowledge(storeId: string, query: string): Promise<string> {
  await connectToDatabase();
  // Broad recommendations use direct bestseller and selected-product facts in the reply prompt.
  // Including arbitrary order batches here would add noise and inflate the prompt.
  if (/\b(recommend|suggest|popular|best[- ]sellers?|something for me)\b/i.test(query)) return "";
  const terms = Array.from(new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []))
    .filter((term) => !STOPWORDS.has(term));
  const chunks = terms.length > 0
    ? await ChatbotKnowledgeChunk.aggregate([
        { $match: { storeId: new Types.ObjectId(storeId) } },
        { $addFields: { relevance: { $add: terms.map((term) => ({
          $cond: [{ $regexMatch: { input: "$searchText", regex: escapeRegex(term), options: "i" } }, 1, 0],
        })) } } },
        { $match: { relevance: { $gt: 0 } } },
        { $sort: { relevance: -1 } },
        { $limit: MAX_CONTEXT_CHUNKS },
        { $project: { kind: 1, batchIndex: 1, sourceData: 1, summary: 1 } },
      ])
    : [];
  const selected = chunks;

  if (selected.length === 0) {
    const existingIndex = await ChatbotKnowledgeChunk.exists({ storeId });
    if (!existingIndex) scheduleStoreKnowledgeRebuild(storeId);
  }

  return selected
    .map((chunk) => `${chunk.kind.toUpperCase()} KNOWLEDGE SUMMARY:\n${chunk.summary.slice(0, 2_000)}`)
    .join("\n\n");
}

const rebuildTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Coalesces bursts of Shopify product/order webhooks into one index update per store. */
export function scheduleStoreKnowledgeRebuild(storeId: string): void {
  if (rebuildTimers.has(storeId)) return;
  rebuildTimers.set(storeId, setTimeout(() => {
    rebuildTimers.delete(storeId);
    void rebuildStoreKnowledgeIndex(storeId).catch((error) => {
      console.error(`Chatbot knowledge indexing failed for store ${storeId}:`, error);
    });
  }, 10_000));
}
