import { NextRequest } from "next/server";
import { chatMessageSchema } from "@/lib/validation/chatbot-message";
import { getPublicChatbotConfig } from "@/services/chatbot-config-service";
import {
  searchStoreProductsWithIntent,
  getPopularProducts,
  isBroadRecommendationRequest,
  isContextualFollowUp,
  getConversationContext,
  generateReply,
  recordMessage,
} from "@/services/chatbot-message-service";
import { Store } from "@/models/Store";
import { connectToDatabase } from "@/lib/mongodb";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { getRelevantStoreKnowledge } from "@/services/chatbot-knowledge-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Public, unauthenticated chat endpoint. AI can translate natural phrasing into catalog terms,
 * but every returned product is verified against the synchronized catalog. Replies fall back
 * to catalog-grounded text when the provider is unavailable. visitorId is anonymous and client generated.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`chat-message:${ip}`, 20, 5 * 60 * 1000);
    if (!limit.success) {
      return fail(429, "RATE_LIMITED", "You're sending messages too quickly. Please slow down.");
    }

    const { storeId, visitorId, message } = chatMessageSchema.parse(await request.json());

    const config = await getPublicChatbotConfig(storeId);
    if (!config) {
      return fail(404, "CHATBOT_NOT_PUBLISHED", "This store has no published chatbot.");
    }

    await connectToDatabase();
    const store = await Store.findById(storeId).select("tenantId shopDomain");
    if (!store) {
      return fail(404, "STORE_NOT_FOUND", "Store not found.");
    }

    const conversation = await getConversationContext(storeId, visitorId, store.shopDomain);

    let products = config.productRecommendationsEnabled && isBroadRecommendationRequest(message)
      ? await getPopularProducts(storeId, store.shopDomain)
      : config.productRecommendationsEnabled
        ? await searchStoreProductsWithIntent(storeId, store.shopDomain, message, {
            tenantId: store.tenantId.toString(),
            storeId,
          }, conversation.history)
        : [];
    if (config.productRecommendationsEnabled && isContextualFollowUp(message)) {
      const combined = [...conversation.products, ...products];
      products = combined.filter((product, index) =>
        combined.findIndex((candidate) => candidate.shopifyProductId === product.shopifyProductId) === index
      ).slice(0, 5);
    }
    const storeKnowledge = await getRelevantStoreKnowledge(storeId, message);
    const reply = await generateReply(config.tone, message, products, {
      tenantId: store.tenantId.toString(),
      storeId,
    }, null, undefined, storeKnowledge, conversation.history);

    await recordMessage(store.tenantId.toString(), storeId, visitorId, message, reply, products);

    return ok({ reply, products });
  } catch (error) {
    return handleApiError(error);
  }
}
