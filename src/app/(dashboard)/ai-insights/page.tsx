"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw, AlertTriangle, Store as StoreIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { selectActiveStore, selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { apiRequest, ApiClientError } from "@/lib/api-client";

interface AiInsight {
  summary: string;
  observations: string[];
  suggestedActions: string[];
  alerts: Array<{
    priority: "urgent" | "warning" | "opportunity";
    title: string;
    detail: string;
    action: string;
  }>;
}

interface StoreOverview {
  currency: string;
  totalOrders: number;
  grossSales: number;
  averageOrderValue: number;
  topProductsByRevenue: Array<{ title: string; revenue: number }>;
  paymentStatusSummary: { paid: number; unpaid: number; other: number };
  bestSellingProducts: Array<{ title: string; quantitySold: number; revenue: number; inventoryUnits: number | null }>;
  slowestSellingProducts: Array<{ title: string; quantitySold: number; revenue: number; inventoryUnits: number | null }>;
  inventorySummary: {
    trackedVariants: number;
    lowStockVariants: number;
    outOfStockVariants: number;
    untrackedVariants: number;
    lowStockProducts: Array<{ title: string; variant: string; quantity: number }>;
    outOfStockProducts: Array<{ title: string; variant: string }>;
  };
}

interface InsightResponse {
  configured: boolean;
  insight: AiInsight | null;
  overview: StoreOverview;
  error: string | null;
}

function InsightCard({ insight, isExample }: { insight: AiInsight; isExample: boolean }) {
  return (
    <div className="space-y-4">
      {insight.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Merchant alerts</CardTitle>
              <p className="mt-1 text-xs text-muted">Actions based on the latest synchronized inventory and orders.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {insight.alerts.map((alert, i) => (
              <div key={i} className="rounded-md border border-border bg-background p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={alert.priority === "urgent" ? "danger" : alert.priority === "warning" ? "warning" : "primary"}>
                    {alert.priority}
                  </Badge>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                </div>
                <p className="text-sm text-muted">{alert.detail}</p>
                <p className="mt-2 text-sm font-medium text-foreground">Next step: {alert.action}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Summary</CardTitle>
            {isExample && <Badge tone="neutral">Data-based fallback</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{insight.summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Observations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-foreground">
              {insight.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Suggested actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-foreground">
              {insight.suggestedActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function buildExampleInsight(overview: StoreOverview): AiInsight {
  const topProduct = overview.topProductsByRevenue[0];
  const slowProduct = overview.slowestSellingProducts.find((product) => product.quantitySold === 0)
    ?? overview.slowestSellingProducts[0];
  const outOfStock = overview.inventorySummary.outOfStockProducts[0];
  const lowStock = overview.inventorySummary.lowStockProducts[0];
  const alerts: AiInsight["alerts"] = [];
  if (outOfStock) {
    alerts.push({
      priority: "urgent",
      title: "Out-of-stock variant",
      detail: outOfStock.title + " — " + outOfStock.variant + " has zero tracked units.",
      action: "Review replenishment and pause promotions for this variant until stock is available.",
    });
  }
  if (lowStock) {
    alerts.push({
      priority: "warning",
      title: "Low inventory",
      detail: lowStock.title + " — " + lowStock.variant + " has " + lowStock.quantity + " units remaining.",
      action: "Check supplier lead time and set a reorder point for this variant.",
    });
  }
  if (slowProduct && alerts.length < 3) {
    alerts.push({
      priority: "opportunity",
      title: slowProduct.quantitySold === 0 ? "No recorded sales" : "Low sales in synced history",
      detail: slowProduct.title + " has " + slowProduct.quantitySold + " units sold in synchronized order history.",
      action: "Review its product page, pricing, and traffic before changing stock or discounting it.",
    });
  }
  return {
    summary: "Your store has " + overview.totalOrders + " synced orders and " + overview.currency + " " + overview.grossSales.toFixed(2) + " in gross sales. " + overview.inventorySummary.outOfStockVariants + " variants are out of stock and " + overview.inventorySummary.lowStockVariants + " are low.",
    observations: [
      topProduct
        ? topProduct.title + " leads revenue at " + overview.currency + " " + topProduct.revenue.toFixed(2) + "."
        : "No product revenue is available in the synchronized line items yet.",
      overview.paymentStatusSummary.paid + " orders are paid; " + overview.paymentStatusSummary.unpaid + " are unpaid or awaiting capture; " + overview.paymentStatusSummary.other + " have another status.",
    ],
    suggestedActions: alerts.length > 0
      ? alerts.map((alert) => alert.action)
      : topProduct
        ? ["Feature " + topProduct.title + " in a high-traffic placement, then compare sales after the change."]
        : ["Sync order history and enable Shopify inventory tracking to unlock product-level sales and stock alerts."],
    alerts,
  };
}

export default function AiInsightsPage() {
  const stores = useAppSelector(selectStores);
  const storesStatus = useAppSelector(selectStoresStatus);
  const activeStore = useAppSelector(selectActiveStore);

  const [data, setData] = useState<InsightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = (refresh = false) => {
    if (!activeStore) return;
    (refresh ? setIsRefreshing : setIsLoading)(true);
    setError(null);
    apiRequest<InsightResponse>(`/api/ai/insights?storeId=${activeStore.id}${refresh ? "&refresh=1" : ""}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load insights."))
      .finally(() => (refresh ? setIsRefreshing : setIsLoading)(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore]);

  if (storesStatus === "succeeded" && stores.length === 0) {
    return (
      <div>
        <PageHeader title="AI Insights" description="Sales opportunities and inventory actions grounded in current store data." />
        <EmptyState
          icon={StoreIcon}
          title="No store connected"
          description="Connect a Shopify store to generate insights from its sales data."
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="AI Insights" description="Sales opportunities and inventory actions grounded in current store data." />
        <div className="h-48 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="AI Insights" description="Sales opportunities and inventory actions grounded in current store data." />
        <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="AI Insights" description="Sales opportunities and inventory actions grounded in current store data." />

      {!data.configured && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>
            AI analysis is unavailable right now. The fallback below uses deterministic checks against your
            synced orders and inventory; connect the NVIDIA provider to get product-specific AI analysis.
          </span>
        </div>
      )}

      {data.configured && data.error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>Insight generation failed: {data.error}</span>
          <Button size="sm" variant="secondary" onClick={() => load(true)} isLoading={isRefreshing}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      {data.configured && data.insight && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => load(true)} isLoading={isRefreshing}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh insight
          </Button>
        </div>
      )}

      <InsightCard
        insight={data.insight ?? buildExampleInsight(data.overview)}
        isExample={!data.insight}
      />

      <p className="mt-4 text-xs text-muted">
        Want to test the storefront chatbot itself?{" "}
        <Link href="/settings" className="font-medium text-primary hover:underline">
          Go to Settings
        </Link>{" "}
        and use the preview link there. It uses synced product facts and AI-assisted catalog matching.
      </p>
    </div>
  );
}
