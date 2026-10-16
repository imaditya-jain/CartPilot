"use client";

import { useEffect, useState } from "react";
import { BarChart3, ShoppingCart, Wallet, TrendingUp, Tag, Package, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ordersByFinancialStatus: Array<{ status: string; count: number }>;
  paymentStatusSummary: { paid: number; unpaid: number; other: number };
  productsByStatus: Array<{ status: string; count: number }>;
  topProductsByRevenue: Array<{ shopifyProductId: string | null; title: string; quantitySold: number; revenue: number }>;
  bestSellingProducts: Array<{ shopifyProductId: string; title: string; quantitySold: number; revenue: number; inventoryUnits: number | null; lowStockVariants: number }>;
  slowestSellingProducts: Array<{ shopifyProductId: string; title: string; quantitySold: number; revenue: number; inventoryUnits: number | null; lowStockVariants: number }>;
  inventorySummary: {
    trackedVariants: number;
    lowStockVariants: number;
    outOfStockVariants: number;
    untrackedVariants: number;
    lowStockProducts: Array<{ shopifyProductId: string; title: string; variant: string; quantity: number }>;
    outOfStockProducts: Array<{ shopifyProductId: string; title: string; variant: string }>;
  };
  dailyTrend: Array<{ day: string; orders: number; grossSales: number; totalDiscounts: number; averageOrderValue: number }>;
}

type ProductPerformance = StoreOverview["bestSellingProducts"][number];

function ProductPerformanceList({
  title,
  products,
  currency,
  metric,
}: {
  title: string;
  products: ProductPerformance[];
  currency: string;
  metric: "best" | "slowest";
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs text-muted">Units sold across synchronized order history</p>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted">No active products found.</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div key={product.shopifyProductId} className="rounded-md border border-border bg-background p-3">
                <p className="break-words text-sm font-medium leading-5 text-foreground">{product.title}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{product.quantitySold.toLocaleString()} sold</span>
                  <span>{currency} {product.revenue.toFixed(2)} revenue</span>
                  <span>{product.inventoryUnits === null ? "Stock not tracked" : product.inventoryUnits.toLocaleString() + " in stock"}</span>
                  {metric === "slowest" && product.quantitySold === 0 && <Badge tone="warning">No recorded sales</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const stores = useAppSelector(selectStores);
  const storesStatus = useAppSelector(selectStoresStatus);
  const activeStore = useAppSelector(selectActiveStore);

  const [overview, setOverview] = useState<StoreOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activeStore) return;
    setIsLoading(true);
    setError(null);
    apiRequest<StoreOverview>(`/api/analytics/overview?storeId=${activeStore.id}`)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load analytics."))
      .finally(() => setIsLoading(false));
  }, [activeStore]);

  if (storesStatus === "succeeded" && stores.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" description="See what sells, what needs stock, and where orders need attention." />
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Analytics are calculated from real synchronized order data — connect and sync a store first."
        />
      </div>
    );
  }

  if (isLoading || (!overview && !error)) {
    return (
      <div>
        <PageHeader title="Analytics" description="See what sells, what needs stock, and where orders need attention." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Analytics" description="See what sells, what needs stock, and where orders need attention." />
        <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      </div>
    );
  }

  const paymentTotal = overview.paymentStatusSummary.paid + overview.paymentStatusSummary.unpaid + overview.paymentStatusSummary.other;
  const paymentWidth = (count: number) => paymentTotal > 0 ? `${(count / paymentTotal) * 100}%` : "0%";
  const inventoryRows = [
    ...overview.inventorySummary.outOfStockProducts.map((item) => ({ ...item, quantity: 0, status: "Out of stock" as const })),
    ...overview.inventorySummary.lowStockProducts.map((item) => ({ ...item, status: "Low stock" as const })),
  ].slice(0, 8);

  return (
    <div>
      <PageHeader title="Analytics" description="See what sells, what needs stock, and where orders need attention." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Total orders"
          value={overview.totalOrders.toLocaleString()}
          icon={ShoppingCart}
          tone="primary"
          trend={overview.dailyTrend.map((d) => d.orders)}
        />
        <KpiTile
          label="Gross sales"
          value={`${overview.currency} ${overview.grossSales.toFixed(2)}`}
          icon={Wallet}
          tone="success"
          trend={overview.dailyTrend.map((d) => d.grossSales)}
        />
        <KpiTile
          label="Average order value"
          value={`${overview.currency} ${overview.averageOrderValue.toFixed(2)}`}
          icon={TrendingUp}
          tone="primary"
          trend={overview.dailyTrend.map((d) => d.averageOrderValue)}
        />
        <KpiTile
          label="Total discounts"
          value={`${overview.currency} ${overview.totalDiscounts.toFixed(2)}`}
          icon={Tag}
          tone="warning"
          trend={overview.dailyTrend.map((d) => d.totalDiscounts)}
        />
      </div>

      <section className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Product performance</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProductPerformanceList title="Best selling" products={overview.bestSellingProducts} currency={overview.currency} metric="best" />
          <ProductPerformanceList title="Fewest units sold" products={overview.slowestSellingProducts} currency={overview.currency} metric="slowest" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Payment status</CardTitle>
              <p className="mt-1 text-xs text-muted">Paid, unpaid, and other statuses across synced orders</p>
            </div>
          </CardHeader>
          <CardContent>
            {paymentTotal > 0 ? (
              <>
                <div
                  className="flex h-3 w-full overflow-hidden rounded-full bg-background"
                  role="img"
                  aria-label={`${overview.paymentStatusSummary.paid} paid, ${overview.paymentStatusSummary.unpaid} unpaid, ${overview.paymentStatusSummary.other} other orders`}
                >
                  <div className="bg-success" style={{ width: paymentWidth(overview.paymentStatusSummary.paid) }} />
                  <div className="bg-warning" style={{ width: paymentWidth(overview.paymentStatusSummary.unpaid) }} />
                  <div className="bg-muted" style={{ width: paymentWidth(overview.paymentStatusSummary.other) }} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { label: "Paid", count: overview.paymentStatusSummary.paid, tone: "success" as const },
                    { label: "Unpaid", count: overview.paymentStatusSummary.unpaid, tone: "warning" as const },
                    { label: "Other", count: overview.paymentStatusSummary.other, tone: "neutral" as const },
                  ].map((status) => (
                    <div key={status.label} className="rounded-md border border-border bg-background p-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <p className="mt-2 text-xl font-semibold text-foreground">{status.count.toLocaleString()}</p>
                      <p className="text-xs text-muted">{((status.count / paymentTotal) * 100).toFixed(1)}% of orders</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">Cancelled orders are excluded. Unpaid includes pending, authorized, and partially paid; other includes refunded and unknown statuses.</p>
              </>
            ) : (
              <p className="text-sm text-muted">No synchronized orders to summarize yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Inventory alerts</CardTitle>
              <p className="mt-1 text-xs text-muted">Tracked variants with 5 or fewer units</p>
            </div>
            {(overview.inventorySummary.outOfStockVariants > 0 || overview.inventorySummary.lowStockVariants > 0) && (
              <Badge tone={overview.inventorySummary.outOfStockVariants > 0 ? "danger" : "warning"}>
                {overview.inventorySummary.outOfStockVariants + overview.inventorySummary.lowStockVariants} need review
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge tone="danger">{overview.inventorySummary.outOfStockVariants} out of stock</Badge>
              <Badge tone="warning">{overview.inventorySummary.lowStockVariants} low stock</Badge>
              <Badge tone="neutral">{overview.inventorySummary.untrackedVariants} untracked</Badge>
            </div>
            {inventoryRows.length > 0 ? (
              <div className="space-y-2">
                {inventoryRows.map((item, index) => (
                  <div key={item.shopifyProductId + item.variant + index} className="flex items-start gap-2 rounded-md border border-border bg-background p-3">
                    <AlertTriangle className={item.status === "Out of stock" ? "mt-0.5 h-4 w-4 text-danger" : "mt-0.5 h-4 w-4 text-warning"} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted">{item.variant} · {item.status}{item.status === "Low stock" ? ` · ${item.quantity} remaining` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : overview.inventorySummary.untrackedVariants > 0 ? (
              <p className="text-sm text-muted">No low-stock alerts. Inventory tracking is off for {overview.inventorySummary.untrackedVariants} variants, so their stock level is unknown.</p>
            ) : (
              <p className="text-sm text-muted">No low-stock or out-of-stock variants detected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
