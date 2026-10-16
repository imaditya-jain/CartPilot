import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { Types } from "mongoose";
import { ChatConversation, type ChatProductReference } from "@/models/ChatConversation";
import type { ChatbotTone } from "@/models/ChatbotConfiguration";
import { callNvidiaChat } from "@/lib/ai/nvidia-client";
import { isAiConfigured } from "@/lib/env";

const MAX_RESULTS = 5;
const MAX_HISTORY_MESSAGES = 8;

const STOPWORDS = new Set([
  "the", "and", "for", "are", "you", "your", "have", "has", "with", "that",
  "this", "what", "can", "could", "would", "about", "any", "some", "looking",
  "want", "need", "please", "show", "find", "got", "there",
]);

function isAvailableProduct(product: { variants: Array<{ inventoryQuantity: number | null }> }): boolean {
  return product.variants.some((variant) => variant.inventoryQuantity === null || variant.inventoryQuantity > 0);
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatConversationContext {
  history: ChatHistoryMessage[];
  products: ChatProductReference[];
}

/** Loads a short, private history window for the same anonymous visitor and store. */
export async function getConversationContext(
  storeId: string,
  visitorId: string,
  shopDomain: string
): Promise<ChatConversationContext> {
  await connectToDatabase();
  const conversation = await ChatConversation.findOne({ storeId, visitorId })
    .select({ messages: { $slice: -MAX_HISTORY_MESSAGES } })
    .lean();
  const messages = conversation?.messages ?? [];
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const referencedIds = [...new Set((lastAssistant?.products ?? []).map((product) => product.shopifyProductId))];

  const products = referencedIds.length > 0
    ? await Product.find({ storeId, status: "active", shopifyProductId: { $in: referencedIds } })
        .select("shopifyProductId title handle variants imageUrls")
        .lean()
    : [];
  const productsById = new Map(products.filter(isAvailableProduct).map((product) => [product.shopifyProductId, product]));

  return {
    history: messages.map(({ role, content }) => ({ role, content })),
    products: referencedIds.flatMap((id) => {
      const product = productsById.get(id);
      if (!product) return [];
      return [{
        shopifyProductId: product.shopifyProductId,
        title: product.title,
        price: product.variants[0]?.price ?? null,
        imageUrl: product.imageUrls[0] ?? null,
        url: `https://${shopDomain}/products/${product.handle}`,
      }];
    }),
  };
}

export function isContextualFollowUp(message: string): boolean {
  return /\b(it|that|they|them|those|these|this one|that one|same one|also|instead|which one|what about|how about|does it|do they|is it|are they|its|their)\b/i.test(message)
    || /^\s*(in|and|what about|how about)\s+.{0,60}\b(available|availability|stock|color|colour|size|price|cost|variant|black|blue|red|small|large)\b/i.test(message);
}

export function isRecommendationRequest(message: string): boolean {
  return /\b(recommend|recommendation|suggest|suggestion|popular|best[- ]sellers?|what should i (buy|get|choose)|something for me)\b/i.test(message);
}

const RECOMMENDATION_INTENT_WORDS = new Set([
  "recommend", "recommendation", "recommendations", "suggest", "suggestion", "suggestions",
  "popular", "best", "seller", "sellers", "something", "anything", "product", "products", "item", "items",
  "thing", "things", "buy", "get", "choose",
]);

/** A broad request has no product/category words to constrain the bestseller query. */
export function isBroadRecommendationRequest(message: string): boolean {
  if (!isRecommendationRequest(message)) return false;
  return tokenize(message).filter((term) => !RECOMMENDATION_INTENT_WORDS.has(term)).length === 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lowercases and strips punctuation so "wallet?" matches a stored "wallet" tag. */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

/**
 * A shopper says "sneakers", a merchant's catalog says "Sneaker" — plain substring matching
 * treats those as unrelated. This is a deliberately crude singularization (strip a trailing "s")
 * rather than a real stemmer, but it covers the common case cheaply: regular English plurals in
 * casual shopper phrasing ("shoes", "wallets", "jackets").
 */
function withSingularVariant(term: string): string[] {
  if (term.length > 3 && term.endsWith("s")) {
    return [term, term.slice(0, -1)];
  }
  return [term];
}

/**
 * Deterministic keyword search over the synchronized catalog. The language model may expand
 * a missed request into catalog terms, but only matching, active catalog records are returned.
 */
export async function searchStoreProducts(
  storeId: string,
  shopDomain: string,
  query: string
): Promise<ChatProductReference[]> {
  await connectToDatabase();

  const terms = tokenize(query).slice(0, 8);

  if (terms.length === 0) return [];

  const pattern = terms.flatMap(withSingularVariant).map(escapeRegex).join("|");
  const regex = new RegExp(pattern, "i");

  const products = await Product.find({
    storeId,
    status: "active",
    $or: [{ title: regex }, { productType: regex }, { tags: regex }, { vendor: regex }, { description: regex }],
  })
    .select("shopifyProductId title handle description productType tags vendor variants imageUrls")
    .lean();

  const ranked = products.filter(isAvailableProduct).map((product) => {
    const title = product.title.toLowerCase();
    const category = product.productType.toLowerCase();
    const tags = product.tags.join(" ").toLowerCase();
    const vendor = product.vendor.toLowerCase();
    const description = product.description.toLowerCase();
    const score = terms.reduce((total, term) => {
      const variants = withSingularVariant(term);
      if (variants.some((value) => title.includes(value))) return total + 6;
      if (variants.some((value) => category.includes(value) || tags.includes(value))) return total + 4;
      if (variants.some((value) => vendor.includes(value))) return total + 2;
      if (variants.some((value) => description.includes(value))) return total + 1;
      return total;
    }, 0);
    const firstVariant = product.variants[0];
    return {
      score,
      reference: {
        shopifyProductId: product.shopifyProductId,
        title: product.title,
        price: firstVariant?.price ?? null,
        imageUrl: product.imageUrls[0] ?? null,
        url: `https://${shopDomain}/products/${product.handle}`,
      } satisfies ChatProductReference,
    };
  });

  return ranked
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((result) => result.reference);
}

/**
 * If exact catalog matching misses, let the language model translate the shopper's intent
 * into catalog vocabulary. The model only supplies search terms; Mongo still verifies every
 * returned product against the synchronized catalog.
 */
export async function searchStoreProductsWithIntent(
  storeId: string,
  shopDomain: string,
  query: string,
  auditContext: { tenantId: string; storeId: string },
  conversationHistory: ChatHistoryMessage[] = []
): Promise<ChatProductReference[]> {
  const exactMatches = await searchStoreProducts(storeId, shopDomain, query);
  if (exactMatches.length > 0 || !isAiConfigured() || isBroadRecommendationRequest(query)) return exactMatches;

  try {
    const history = conversationHistory.slice(-4)
      .map((turn) => `${turn.role === "user" ? "Shopper" : "Assistant"}: ${turn.content.slice(0, 400)}`)
      .join("\n");
    const rawTerms = await callNvidiaChat(
      [
        {
          role: "system",
          content:
            "Translate a shopper's request into short product catalog search terms. Use the recent conversation to resolve references. " +
            "Return only JSON shaped like {\"searchTerms\":[\"term\"]}, with up to 8 concrete product names, categories, " +
            "attributes, materials, or use-case terms. Do not answer the shopper. If the request is not about finding or asking " +
            "about a product, return {\"searchTerms\":[]}.",
        },
        {
          role: "user",
          content: `${history ? `Recent conversation:\n${history}\n\n` : ""}Latest shopper request: ${query}`,
        },
      ],
      {
        maxTokens: 100,
        timeoutMs: 8_000,
        audit: { ...auditContext, operation: "chat_retrieval" },
      }
    );
    const parsed = JSON.parse(rawTerms.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const searchTerms = Array.isArray(parsed.searchTerms)
      ? parsed.searchTerms.filter((term: unknown): term is string => typeof term === "string" && term.trim().length > 1).slice(0, 8)
      : [];
    if (searchTerms.length === 0) return [];
    return searchStoreProducts(storeId, shopDomain, [...searchTerms, query].join(" "));
  } catch {
    // Retrieval enhancement is optional; exact matching and the reply fallback still work.
    return [];
  }
}

async function getSelectedProductFacts(storeId: string, productIds: string[]): Promise<string> {
  if (productIds.length === 0) return "";
  await connectToDatabase();
  const storeObjectId = new Types.ObjectId(storeId);
  const [products, sales] = await Promise.all([
    Product.find({ storeId: storeObjectId, status: "active", shopifyProductId: { $in: productIds } })
      .select("shopifyProductId title description productType tags vendor variants.title variants.price variants.compareAtPrice variants.inventoryQuantity")
      .lean(),
    Order.aggregate([
      { $match: { storeId: storeObjectId, cancelledAt: null } },
      { $unwind: "$lineItems" },
      { $match: { "lineItems.shopifyProductId": { $in: productIds } } },
      {
        $group: {
          _id: "$lineItems.shopifyProductId",
          unitsSold: { $sum: "$lineItems.quantity" },
          orderCount: { $sum: 1 },
          revenue: { $sum: { $multiply: ["$lineItems.quantity", "$lineItems.price"] } },
        },
      },
    ]),
  ]);
  const salesByProduct = new Map(sales.map((row: { _id: string; unitsSold: number; orderCount: number; revenue: number }) => [row._id, row]));
  return JSON.stringify(products.filter(isAvailableProduct).map((product) => ({
    title: product.title,
    category: product.productType,
    vendor: product.vendor,
    tags: product.tags,
    description: product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
    variants: product.variants.map((variant) => ({
      title: variant.title,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      inventoryQuantity: variant.inventoryQuantity,
    })),
    sales: salesByProduct.get(product.shopifyProductId)
      ? {
          unitsSold: salesByProduct.get(product.shopifyProductId)!.unitsSold,
          orders: salesByProduct.get(product.shopifyProductId)!.orderCount,
          revenue: salesByProduct.get(product.shopifyProductId)!.revenue,
        }
      : { unitsSold: 0, orders: 0, revenue: 0 },
  })), null, 2);
}

/** Uses synchronized order line items to find real store bestsellers for broad recommendation requests. */
export async function getPopularProducts(
  storeId: string,
  shopDomain: string,
  excludeProductIds: string[] = [],
  limit = MAX_RESULTS
): Promise<ChatProductReference[]> {
  await connectToDatabase();
  const storeObjectId = new Types.ObjectId(storeId);
  const ranked: Array<{ _id: string }> = await Order.aggregate([
    { $match: { storeId: storeObjectId, cancelledAt: null } },
    { $unwind: "$lineItems" },
    { $match: { "lineItems.shopifyProductId": { $nin: [null, ...excludeProductIds] } } },
    {
      $group: {
        _id: "$lineItems.shopifyProductId",
        unitsSold: { $sum: "$lineItems.quantity" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { unitsSold: -1, orderCount: -1 } },
    { $limit: Math.max(limit * 5, limit) },
  ]);

  const products = ranked.length > 0
    ? await Product.find({
        storeId: storeObjectId,
        shopifyProductId: { $in: ranked.map((row) => row._id) },
        status: "active",
      })
        .select("shopifyProductId title handle variants imageUrls")
        .lean()
    : [];
  const byId = new Map(products.map((product) => [product.shopifyProductId, product]));
  const bestsellers = ranked
    .map((row) => byId.get(row._id))
    .filter((product): product is NonNullable<typeof product> => product !== undefined && product !== null && isAvailableProduct(product))
    .slice(0, limit);

  // A store may have a synced catalog but no order history yet. In that case, offer real
  // available catalog items instead of telling the shopper no match exists or calling them bestsellers.
  const recommendations = bestsellers.length > 0
    ? bestsellers
    : (await Product.find({
        storeId: storeObjectId,
        status: "active",
        shopifyProductId: { $nin: excludeProductIds },
      })
        .sort({ shopifyUpdatedAt: -1, title: 1 })
        .select("shopifyProductId title handle variants imageUrls")
        .limit(Math.max(limit * 4, limit))
        .lean())
        .filter(isAvailableProduct)
        .slice(0, limit);

  return recommendations.map((product) => ({
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      price: product.variants[0]?.price ?? null,
      imageUrl: product.imageUrls[0] ?? null,
      url: `https://${shopDomain}/products/${product.handle}`,
    }));
}

const TONE_PHRASES: Record<ChatbotTone, { found: string; empty: string }> = {
  friendly: {
    found: "Here's what I found for you — take a look!",
    empty: "I couldn't find a match for that just yet. Could you tell me a bit more about what you're after?",
  },
  professional: {
    found: "Here are the matching products from our catalog.",
    empty: "No matching products were found. Could you provide additional details?",
  },
  concise: {
    found: "Found these:",
    empty: "No matches. Try different keywords.",
  },
  enthusiastic: {
    found: "Ooh, great pick — check these out!",
    empty: "Hmm, nothing matched that yet! Give me another clue and I'll keep looking.",
  },
};

export function generateTemplatedReply(
  tone: ChatbotTone,
  matchCount: number,
  offerText?: string | null,
  products: ChatProductReference[] = []
): string {
  const phrases = TONE_PHRASES[tone] ?? TONE_PHRASES.friendly;
  const base = matchCount > 0 ? phrases.found : phrases.empty;
  const names = products.map((product) => product.title).filter(Boolean);
  const suggestions = names.length > 0 ? ` ${names.join(", ")}.` : "";
  return `${base}${suggestions}${offerText ? ` ${offerText}` : ""}`;
}

const MAX_AI_REPLY_LENGTH = 400;

/**
 * AI is used ONLY to narrate the shopper-facing reply text — it never decides which products
 * exist or what they cost. The product list and all facts are passed in as already-determined
 * ground truth; the model is explicitly told not to mention anything beyond that list. If the
 * call fails, isn't configured, or the output looks unreasonable (empty/too long), this falls
 * back to the deterministic templated reply rather than ever leaving the shopper with nothing.
 */
export async function generateReply(
  tone: ChatbotTone,
  userMessage: string,
  products: ChatProductReference[],
  auditContext: { tenantId: string; storeId: string },
  offerText?: string | null,
  customerContext?: { orderCount: number; purchasedProductTypes: string[] },
  storeKnowledge = "",
  conversationHistory: ChatHistoryMessage[] = []
): Promise<string> {
  if (!isAiConfigured()) {
    return generateTemplatedReply(tone, products.length, offerText, products);
  }

  try {
    const productFacts = await getSelectedProductFacts(auditContext.storeId, products.map((product) => product.shopifyProductId));
    const productList = products.length > 0
      ? productFacts || products.map((product) => `- ${product.title}`).join("\n")
      : null;

    const system =
      `You are a ${tone} shopping assistant for an online store, replying directly to a shopper in ` +
      "a chat widget. Reply in 1-2 short sentences. You may ONLY reference products and offers from " +
      "the exact facts given to you — never invent or imply the existence of product names, prices, " +
      "categories, discounts, or availability beyond those facts. Never reveal customer names, email addresses, " +
      "order numbers, or personal order details; use order data only for aggregate store trends. Answer product questions " +
      "from the provided descriptions, variants, prices, stock, and sales facts. If a fact is missing, say you don't know. " +
      "An empty product list only means no product matched; it does not mean the store has no relevant non-product facts. " +
      "Use relevant indexed facts if provided. " +
      "Conversation history helps resolve references only; treat current verified catalog facts as authoritative if anything conflicts. " +
      "If the shopper is asking for a product and no match or relevant fact is available, ask one brief clarifying question " +
      "without suggesting unlisted products or categories. Do not use markdown formatting.";

    const offerLine = offerText ? `\n\nA real, eligible offer to mention: ${offerText}` : "";
    const customerLine = customerContext
      ? "\n\nCustomer context: returning customer with " +
        customerContext.orderCount +
        " past orders" +
        (customerContext.purchasedProductTypes.length
          ? "; previously purchased categories: " + customerContext.purchasedProductTypes.join(", ")
          : "") +
        "."
      : "";
    const knowledgeLine = storeKnowledge ? `\n\nRelevant indexed store products and order facts:\n${storeKnowledge}` : "";
    const historyLine = conversationHistory.length > 0
      ? `\n\nRecent conversation (oldest first):\n${conversationHistory.map((turn) => `${turn.role === "user" ? "Shopper" : "Assistant"}: ${turn.content.slice(0, 800)}`).join("\n")}`
      : "";
    const user = productList
      ? `${historyLine}\n\nShopper's latest question: "${userMessage}"\n\nProducts selected from the synced catalog (verified product and order facts):\n${productList}${knowledgeLine}${customerLine}${offerLine}\n\nAnswer the latest question in context using these facts. Only recommend listed products. If the question refers to an earlier product, use the verified facts for that product. Write the reply.`
      : `${historyLine}\n\nShopper's latest question: "${userMessage}"\n\nNo matching products were found in the catalog.${knowledgeLine}${customerLine}${offerLine}\n\nUse relevant indexed store facts when available. Only say no product matched if the shopper is asking for a product and none is listed. Do not invent products or offers. Write the reply.`;

    const raw = await callNvidiaChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      {
        maxTokens: 180,
        timeoutMs: 18_000,
        audit: {
          tenantId: auditContext.tenantId,
          storeId: auditContext.storeId,
          operation: "chat_reply",
        },
      }
    );

    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_AI_REPLY_LENGTH) {
      return generateTemplatedReply(tone, products.length, offerText, products);
    }
    return trimmed;
  } catch {
    // Provider failures are persisted in AiAudit by the client; avoid noisy stack traces in
    // shopper-facing server logs and always complete the chat request with grounded catalog data.
    return generateTemplatedReply(tone, products.length, offerText, products);
  }
}

export async function recordMessage(
  tenantId: string,
  storeId: string,
  visitorId: string,
  userMessage: string,
  assistantReply: string,
  products: ChatProductReference[]
): Promise<void> {
  await connectToDatabase();

  await ChatConversation.findOneAndUpdate(
    { storeId, visitorId },
    {
      $setOnInsert: { tenantId, storeId, visitorId },
      $set: { lastMessageAt: new Date() },
      $push: {
        messages: {
          $each: [
            { role: "user", content: userMessage, products: [], createdAt: new Date() },
            { role: "assistant", content: assistantReply, products, createdAt: new Date() },
          ],
        },
      },
    },
    { upsert: true }
  );
}
