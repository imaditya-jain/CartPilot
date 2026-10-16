"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAppSelector } from "@/store/hooks";
import { selectActiveStore } from "@/features/stores/storesSelectors";
import { apiRequest, ApiClientError } from "@/lib/api-client";

interface ProductVariant {
  shopifyVariantId: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number | null;
}

interface ProductDetail {
  id: string;
  title: string;
  handle: string;
  description: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  imageUrls: string[];
  variants: ProductVariant[];
  shopifyUpdatedAt: string;
  syncedAt: string;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "warning"> = {
  active: "success",
  draft: "neutral",
  archived: "warning",
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const activeStore = useAppSelector(selectActiveStore);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest<ProductDetail>(`/api/products/${params.id}`)
      .then(setProduct)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load product."))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-lg bg-surface" />;
  }

  if (error || !product) {
    return (
      <div>
        <button
          onClick={() => router.push("/products")}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to products
        </button>
        <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error ?? "Product not found."}
        </div>
      </div>
    );
  }

  const shopifyUrl = activeStore ? `https://${activeStore.shopDomain}/products/${product.handle}` : null;

  return (
    <div>
      <button
        onClick={() => router.push("/products")}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to products
      </button>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          {product.imageUrls.length > 0 ? (
            <div className="space-y-2">
              <div className="aspect-square overflow-hidden rounded-lg border border-border bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrls[0]} alt={product.title} className="h-full w-full object-cover" />
              </div>
              {product.imageUrls.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {product.imageUrls.slice(1, 5).map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt={product.title}
                      className="aspect-square rounded-md border border-border object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted">
              No image
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{product.title}</h1>
            <Badge tone={STATUS_TONE[product.status] ?? "neutral"}>{product.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {product.vendor && <span>{product.vendor}</span>}
            {product.vendor && product.productType && <span> · </span>}
            {product.productType && <span>{product.productType}</span>}
          </p>

          {product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {product.description && <p className="mt-4 text-sm text-foreground">{product.description}</p>}

          {shopifyUrl && (
            <a
              href={shopifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              View on Shopify
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}

          <Card className="mt-6">
            <CardContent className="overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Variant</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">Compare at</th>
                    <th className="px-4 py-3 font-medium">Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => (
                    <tr key={variant.shopifyVariantId} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{variant.title}</td>
                      <td className="px-4 py-3 text-muted">{variant.sku || "—"}</td>
                      <td className="px-4 py-3 text-muted">${variant.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-muted">
                        {variant.compareAtPrice ? `$${variant.compareAtPrice.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted">{variant.inventoryQuantity ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <p className="mt-4 text-xs text-muted">
            Last updated on Shopify {new Date(product.shopifyUpdatedAt).toLocaleString()} · Synced{" "}
            {new Date(product.syncedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
