"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Store as StoreIcon, Package, ShoppingCart, Sparkles, ArrowRight, Wallet, TrendingUp, Tag, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SyncStatusBar } from "@/components/dashboard/sync-status-bar";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { useAppSelector } from "@/store/hooks";
import { selectActiveStore, selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { apiRequest, ApiClientError } from "@/lib/api-client";

interface StoreOverview {
  currency: string;
  totalOrders: number;
  grossSales: number;
  totalDiscounts: number;
  averageOrderValue: number;
  dailyTrend: Array<{ day: string; orders: number; grossSales: number; totalDiscounts: number; averageOrderValue: number }>;
  inventorySummary: {
    lowStockVariants: number;
    outOfStockVariants: number;
    untrackedVariants: number;
    lowStockProducts: Array<{ title: string; variant: string; quantity: number }>;
    outOfStockProducts: Array<{ title: string; variant: string }>;
  };
}

interface InsightStatus {
  configured: boolean;
  insight: { summary: string; alerts: Array<{ priority: string; title: string; detail: string; action: string }> } | null;
  error: string | null;
}

export default function DashboardPage() {
  const stores = useAppSelector(selectStores);
  const storesStatus = useAppSelector(selectStoresStatus);
  const activeStore = useAppSelector(selectActiveStore);

  const [overview, setOverview] = useState<StoreOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [insightStatus, setInsightStatus] = useState<InsightStatus | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  // Guards against a stale response overwriting a newer one — matters both for React Strict
  // Mode's dev-only double-invoke of effects and for a real user re-navigating quickly, since
  // this endpoint can take several seconds (it's a live AI provider call, not a cheap fetch).
  const insightRequestId = useRef(0);

  const showEmptyState = storesStatus === "succeeded" && stores.length === 0;

  useEffect(() => {
    if (!activeStore) return;
    setIsLoadingOverview(true);
    setOverviewError(null);
    apiRequest<StoreOverview>(`/api/analytics/overview?storeId=${activeStore.id}`)
      .then(setOverview)
      .catch((err) => setOverviewError(err instanceof ApiClientError ? err.message : "Failed to load KPIs."))
      .finally(() => setIsLoadingOverview(false));

    const requestId = ++insightRequestId.current;
    setIsLoadingInsight(true);
    apiRequest<InsightStatus>(`/api/ai/insights?storeId=${activeStore.id}`)
      .then((result) => {
        if (insightRequestId.current === requestId) setInsightStatus(result);
      })
      .catch(() => {
        if (insightRequestId.current === requestId) setInsightStatus(null);
      })
      .finally(() => {
        if (insightRequestId.current === requestId) setIsLoadingInsight(false);
      });
  }, [activeStore]);

  return (
    <div>
      <PageHeader title="Dashboard" description="An overview of your store's performance." />

      {showEmptyState && (
        <EmptyState
          icon={StoreIcon}
          title="Connect a Shopify store to get started"
          description="Once a store is connected and synchronized, you'll see sales KPIs, recent orders, and AI insights here."
          action={
            <Link href="/stores">
              <Button size="sm">Connect store</Button>
            </Link>
          }
        />
      )}

      {!showEmptyState && activeStore && (
        <div className="flex flex-col gap-4">
          <SyncStatusBar
            storeId={activeStore.id}
            countLabel={`${activeStore.productCount} products · ${activeStore.orderCount} orders`}
            className="mb-0"
          />

          {isLoadingOverview || !overview ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />
              ))}
            </div>
          ) : overviewError ? (
            <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {overviewError}
            </div>
          ) : (
            <>
              {overview.totalOrders > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiTile label="Total orders" value={overview.totalOrders.toLocaleString()} icon={ShoppingCart} tone="primary" trend={overview.dailyTrend.map((d) => d.orders)} />
                  <KpiTile label="Gross sales" value={`${overview.currency} ${overview.grossSales.toFixed(2)}`} icon={Wallet} tone="success" trend={overview.dailyTrend.map((d) => d.grossSales)} />
                  <KpiTile label="Average order value" value={`${overview.currency} ${overview.averageOrderValue.toFixed(2)}`} icon={TrendingUp} tone="primary" trend={overview.dailyTrend.map((d) => d.averageOrderValue)} />
                  <KpiTile label="Total discounts" value={`${overview.currency} ${overview.totalDiscounts.toFixed(2)}`} icon={Tag} tone="warning" trend={overview.dailyTrend.map((d) => d.totalDiscounts)} />
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">No orders have synced yet. Inventory monitoring is active for the product catalog.</div>
              )}
              {(overview.inventorySummary.outOfStockVariants > 0 || overview.inventorySummary.lowStockVariants > 0 || overview.inventorySummary.untrackedVariants > 0) && (
                <Link href="/analytics" className="block">
                  <Card className="border-warning/30 transition-colors hover:border-warning/60">
                    <CardContent className="flex items-start gap-3 pt-5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Inventory needs attention</p>
                        <p className="text-sm text-muted">{overview.inventorySummary.outOfStockVariants} out of stock · {overview.inventorySummary.lowStockVariants} low stock · {overview.inventorySummary.untrackedVariants} untracked</p>
                        {[...overview.inventorySummary.outOfStockProducts, ...overview.inventorySummary.lowStockProducts].slice(0, 2).map((item, index) => (
                          <p key={item.title + item.variant + index} className="mt-1 break-words text-xs text-muted">{item.title} · {item.variant}</p>
                        ))}
                      </div>
                      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
                    </CardContent>
                  </Card>
                </Link>
              )}
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/products" className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 pt-5">
                  <Package className="h-5 w-5 text-muted" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-foreground">View products</p>
                    <p className="text-sm text-muted">See the synchronized catalog</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/orders" className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 pt-5">
                  <ShoppingCart className="h-5 w-5 text-muted" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-foreground">View orders</p>
                    <p className="text-sm text-muted">See synchronized order history</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {overview && overview.totalOrders > 0 && (
            <Link href="/analytics" className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center justify-between pt-5">
                  <span className="text-sm font-medium text-foreground">
                    View full analytics — trends, top products, payment status breakdown
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          )}

          {isLoadingInsight ? (
            <div className="h-16 animate-pulse rounded-lg bg-surface" />
          ) : insightStatus?.insight ? (
            <Link href="/ai-insights" className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-start gap-3 pt-5">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">AI insight</p>
                    <p className="text-sm text-muted">{insightStatus.insight.alerts?.length ? insightStatus.insight.alerts[0].title + " — " + insightStatus.insight.alerts[0].detail : insightStatus.insight.summary}</p>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 flex-shrink-0 text-muted" aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          ) : insightStatus === null ? (
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>Couldn&apos;t check AI insight status just now — see the AI Insights page directly.</span>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted">
              <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                {insightStatus.configured
                  ? "AI insights are configured but the last generation attempt failed — see the AI Insights page for details and to retry."
                  : "AI-generated insights (plain-language summaries, suggested actions) aren't configured yet — add an NVIDIA API key to enable them."}{" "}
                Sales KPIs above are real, calculated from synchronized order data.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
