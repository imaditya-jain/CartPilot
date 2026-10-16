import { createHash } from "node:crypto";
import { getStoreOverview, type StoreOverview } from "@/services/analytics-service";
import { callNvidiaChat, AiNotConfiguredError, AiProviderError } from "@/lib/ai/nvidia-client";
import { aiInsightSchema, extractJsonObject, type AiInsight } from "@/lib/validation/ai-insights";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — real sales data doesn't shift fast enough to need fresher AI commentary than this.
const cache = new Map<string, { insight: AiInsight; overview: StoreOverview; fingerprint: string; expiresAt: number }>();

function buildPrompt(overview: StoreOverview): Array<{ role: string; content: string }> {
  const system =
    "You are a practical growth and inventory analyst for a Shopify merchant. Use only the supplied " +
    "synced order, product, payment, and inventory data. Identify actionable ways to increase sales " +
    "and prevent stockouts. Separate observed facts from hypotheses; never claim a cause the data does " +
    "not prove, invent metrics, recommend replenishment quantities, or say an alert was delivered. " +
    "Units sold are totals across synchronized order history, not a rate; do not claim a product is declining " +
    "or underperforming relative to its age. Give 2-4 specific observations and actions, plus up to 3 alerts " +
    "only when the data supports them. Prioritize named products and concrete next steps. Return valid JSON only: " +
    '{"summary": string, "observations": string[], "suggestedActions": string[], "alerts": [{"priority":string, "title":string, "detail":string, "action":string}]}. ' +
    "Each alert priority must be exactly urgent, warning, or opportunity; return alerts: [] if none are supported.";

  const user = `Store metrics (currency: ${overview.currency}):\n${JSON.stringify(
    {
      totalOrders: overview.totalOrders,
      grossSales: overview.grossSales,
      averageOrderValue: overview.averageOrderValue,
      totalDiscounts: overview.totalDiscounts,
      ordersByFinancialStatus: overview.ordersByFinancialStatus,
      paymentStatusSummary: overview.paymentStatusSummary,
      productsByStatus: overview.productsByStatus,
      topProductsByRevenue: overview.topProductsByRevenue,
      bestSellingProducts: overview.bestSellingProducts,
      slowestSellingProducts: overview.slowestSellingProducts,
      inventorySummary: overview.inventorySummary,
      dailyTrend: overview.dailyTrend,
    },
    null,
    2
  )}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export interface InsightResult {
  configured: boolean;
  insight: AiInsight | null;
  overview: StoreOverview;
  error: string | null;
}

/**
 * Generates (or returns a cached) AI insight grounded in real aggregated sales data. Never lets
 * the model's output stand in for the deterministic numbers themselves — those always come from
 * getStoreOverview's MongoDB aggregation, with the model only asked to narrate them.
 */
export async function getOrGenerateInsight(
  storeId: string,
  tenantId: string,
  forceRefresh = false
): Promise<InsightResult> {
  const overview = await getStoreOverview(storeId, tenantId);
  const fingerprint = createHash("sha256").update(JSON.stringify(overview)).digest("hex");

  const cacheKey = storeId;
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && cached.fingerprint === fingerprint && cached.expiresAt > Date.now()) {
    return { configured: true, insight: cached.insight, overview, error: null };
  }

  try {
    const raw = await callNvidiaChat(buildPrompt(overview), {
      maxTokens: 900,
      timeoutMs: 18_000,
      audit: { tenantId, storeId, operation: "ai_insight" },
    });
    const parsed = aiInsightSchema.parse(extractJsonObject(raw));
    cache.set(cacheKey, { insight: parsed, overview, fingerprint, expiresAt: Date.now() + CACHE_TTL_MS });
    return { configured: true, insight: parsed, overview, error: null };
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return { configured: false, insight: null, overview, error: null };
    }
    const message =
      error instanceof AiProviderError
        ? error.message
        : "The AI provider returned a response that couldn't be validated.";
    console.error(`AI insight generation failed for store ${storeId}:`, error);
    return { configured: true, insight: null, overview, error: message };
  }
}
