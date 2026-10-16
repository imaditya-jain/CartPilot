"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncStatusBar } from "@/components/dashboard/sync-status-bar";
import { useAppSelector } from "@/store/hooks";
import { selectActiveStore, selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { apiRequest, ApiClientError } from "@/lib/api-client";

interface ProductRow {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  imageUrl: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  totalInventory: number;
  shopifyUpdatedAt: string;
}

interface ProductsResponse {
  items: ProductRow[];
  page: number;
  totalPages: number;
  total: number;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "warning"> = {
  active: "success",
  draft: "neutral",
  archived: "warning",
};

function formatPriceRange(min: number | null, max: number | null) {
  if (min === null) return "—";
  if (min === max) return `$${min.toFixed(2)}`;
  return `$${min.toFixed(2)} – $${max!.toFixed(2)}`;
}

export default function ProductsPage() {
  const router = useRouter();
  const stores = useAppSelector(selectStores);
  const storesStatus = useAppSelector(selectStoresStatus);
  const activeStore = useAppSelector(selectActiveStore);

  const [data, setData] = useState<ProductsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      if (!activeStore) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiRequest<ProductsResponse>(
          `/api/products?storeId=${activeStore.id}&page=${targetPage}&pageSize=25`
        );
        setData(result);
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to load products.");
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
        <PageHeader title="Products" description="Products synchronized from your connected store." />
        <EmptyState
          icon={Package}
          title="No store connected"
          description="Connect a Shopify store to synchronize its product catalog."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Products" description="Products synchronized from your connected store." />

      <SyncStatusBar
        storeId={activeStore?.id}
        onSyncComplete={() => load(page)}
        countLabel={activeStore ? `${activeStore.productCount} products` : undefined}
      />

      {error && (
        <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!isLoading && data && data.total === 0 ? (
        <EmptyState
          icon={Package}
          title="No products synchronized yet"
          description="Run a sync above to pull in your product catalog."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Inventory</th>
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
                : data?.items.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => router.push(`/products/${product.id}`)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
                    >
                      <td className="flex items-center gap-3 px-4 py-3">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="h-9 w-9 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 flex-shrink-0 rounded-md bg-background" />
                        )}
                        <span className="font-medium text-foreground">{product.title}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[product.status] ?? "neutral"}>{product.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted">{product.vendor || "—"}</td>
                      <td className="px-4 py-3 text-muted">
                        {formatPriceRange(product.minPrice, product.maxPrice)}
                      </td>
                      <td className="px-4 py-3 text-muted">{product.totalInventory}</td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
              <span>
                Page {data.page} of {data.totalPages} · {data.total} products
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
