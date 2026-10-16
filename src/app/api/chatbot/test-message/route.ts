import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { chatbotTestMessageSchema } from "@/lib/validation/chatbot-test";
import { requireOwnedStore } from "@/services/store-service";
import { getOrCreateChatbotConfig } from "@/services/chatbot-config-service";
import {
  searchStoreProductsWithIntent,
  getPopularProducts,
  isBroadRecommendationRequest,
  generateReply,
} from "@/services/chatbot-message-service";
import {
  getCustomerPurchaseProfile,
  getUpsellProducts,
  getBundleProducts,
  getProductTags,
} from "@/services/recommendation-service";
import { listRulesForStore } from "@/services/discount-rule-service";
import { findEligibleRule } from "@/services/discount-eligibility-service";
import { ok, handleApiError } from "@/lib/utils/api-response";
import type { ChatProductReference } from "@/models/ChatConversation";
import { getRelevantStoreKnowledge } from "@/services/chatbot-knowledge-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function describeOffer(discountType: "percentage" | "fixed_amount", discountValue: number): string {
  return discountType === "percentage" ? `${discountValue}% off` : `${discountValue} off`;
}

/**
 * Authenticated, dashboard-only "test as a customer" endpoint. Unlike the public
 * /api/chatbot/message route (anonymous visitors only), this accepts a real customerId —
 * which is why it requires auth + requireOwnedStore rather than being reachable from the
 * public storefront widget. It never writes to ChatConversation: this is merchant-side
 * testing, not real shopper traffic.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const { storeId, customerId, message } = chatbotTestMessageSchema.parse(await request.json());

    const store = await requireOwnedStore(storeId, auth.userId);
    const config = await getOrCreateChatbotConfig(storeId, auth.userId);

    const [directMatches, profile, rules] = await Promise.all([
      config.productRecommendationsEnabled
        && !isBroadRecommendationRequest(message)
        ? searchStoreProductsWithIntent(storeId, store.shopDomain, message, {
            tenantId: auth.userId,
            storeId,
          })
        : Promise.resolve<ChatProductReference[]>([]),
      getCustomerPurchaseProfile(storeId, auth.userId, customerId),
      config.offersEnabled ? listRulesForStore(storeId, auth.userId) : Promise.resolve([]),
    ]);

    const [upsellProducts, bundleProducts] = await Promise.all([
      getUpsellProducts(storeId, store.shopDomain, profile),
      getBundleProducts(storeId, store.shopDomain, profile),
    ]);

    const recommendationProducts =
      directMatches.length === 0 &&
      upsellProducts.length === 0 &&
      bundleProducts.length === 0 &&
      config.productRecommendationsEnabled &&
      isBroadRecommendationRequest(message)
        ? await getPopularProducts(storeId, store.shopDomain, profile.purchasedProductIds)
        : [];

    const combinedProductIds = [...directMatches, ...recommendationProducts, ...upsellProducts, ...bundleProducts].map(
      (p) => p.shopifyProductId
    );
    const suggestedTags = await getProductTags(storeId, combinedProductIds);

    const eligibleRule = findEligibleRule(rules, profile, suggestedTags);
    const offer = eligibleRule
      ? {
          ruleId: eligibleRule._id.toString(),
          name: eligibleRule.name,
          discountType: eligibleRule.discountType,
          discountValue: eligibleRule.discountValue,
        }
      : null;
    const offerText = offer ? `They're eligible for ${describeOffer(offer.discountType, offer.discountValue)} (${offer.name}).` : null;

    const allProducts = [...directMatches, ...recommendationProducts, ...upsellProducts, ...bundleProducts].filter(
      (product, index, products) => products.findIndex((candidate) => candidate.shopifyProductId === product.shopifyProductId) === index
    );
    const storeKnowledge = await getRelevantStoreKnowledge(storeId, message);
    const reply = await generateReply(config.tone, message, allProducts, { tenantId: auth.userId, storeId }, offerText, {
      orderCount: profile.orderCount,
      purchasedProductTypes: profile.purchasedProductTypes,
    }, storeKnowledge);

    return ok({ reply, products: [...directMatches, ...recommendationProducts], upsellProducts, bundleProducts, offer });
  } catch (error) {
    return handleApiError(error);
  }
}
