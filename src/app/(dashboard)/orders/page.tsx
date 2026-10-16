"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncStatusBar } from "@/components/dashboard/sync-status-bar";
import { useAppSelector } from "@/store/hooks";
import { selectActiveStore, selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { apiRequest, ApiClientError } from "@/lib/api-client";

interface OrderRow {
  id: string;
  name: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  currency: string;
  totalPrice: number;
  cancelledAt: string | null;
  shopifyCreatedAt: string;
}

interface OrdersResponse {
  items: OrderRow[];
  page: number;
  totalPages: number;
  total: number;
}

const FINANCIAL_TONE: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  paid: "success",
  pending: "warning",
  refunded: "neutral",
  voided: "danger",
  partially_refunded: "warning",
  partially_paid: "warning",
};

const FULFILLMENT_TONE: Record<string, "success" | "neutral" | "warning"> = {
  fulfilled: "success",
  unfulfilled: "warning",
  partial: "warning",
};

export default function OrdersPage() {
  const router = useRouter();
  const stores = useAppSelector(selectStores);
  const storesStatus = useAppSelector(selectStoresStatus);
  const activeStore = useAppSelector(selectActiveStore);

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      if (!activeStore) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiRequest<OrdersResponse>(
          `/api/orders?storeId=${activeStore.id}&page=${targetPage}&pageSize=25`
        );
        setData(result);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load orders.");
      } finally {
        setIsLoading(false);
      }
    },
    [activeStore]
  );

  useEffect(() => {
    setPage(1);
    load(1);
  }, [load]);

  if (storesStatus === "succeeded" && stores.length === 0) {
    return (
      <div>
        <PageHeader title="Orders" description="Orders synchronized from your connected store." />
        <EmptyState
          icon={ShoppingCart}
          title="No store connected"
          description="Connect a Shopify store to synchronize its order history."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Orders" description="Orders synchronized from your connected store." />

      <SyncStatusBar
        storeId={activeStore?.id}
        onSyncComplete={() => load(page)}
        countLabel={activeStore ? `${activeStore.orderCount} orders` : undefined}
      />

      {error && (
        <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!isLoading && data && data.total === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders synchronized yet"
          description="Run a sync above to pull in your order history."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Fulfillment</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !data
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="h-5 w-full animate-pulse rounded bg-background" />
                      </td>
                    </tr>
                  ))
                : data?.items.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{order.name}</td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(order.shopifyCreatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {order.financialStatus ? (
                          <Badge tone={FINANCIAL_TONE[order.financialStatus] ?? "neutral"}>
                            {order.financialStatus.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {order.fulfillmentStatus ? (
                          <Badge tone={FULFILLMENT_TONE[order.fulfillmentStatus] ?? "neutral"}>
                            {order.fulfillmentStatus.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {order.currency} {order.totalPrice.toFixed(2)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
              <span>
                Page {data.page} of {data.totalPages} · {data.total} orders
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1 || isLoading}
                  onClick={() => {
                    const next = page - 1;
                    setPage(next);
                    load(next);
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= data.totalPages || isLoading}
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    load(next);
                  }}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
