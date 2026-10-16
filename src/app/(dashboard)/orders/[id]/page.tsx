"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, ApiClientError } from "@/lib/api-client";

interface LineItem {
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  title: string;
  quantity: number;
  price: number;
  imageUrl: string | null;
  productHandle: string | null;
}

interface OrderDetail {
  id: string;
  name: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  currency: string;
  subtotalPrice: number;
  totalDiscounts: number;
  totalPrice: number;
  lineItems: LineItem[];
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
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

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest<OrderDetail>(`/api/orders/${params.id}`)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load order."))
      .finally(() => setIsLoading(false));
  }, [params.id]);

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-lg bg-surface" />;
  }

  if (error || !order) {
    return (
      <div>
        <button
          onClick={() => router.push("/orders")}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to orders
        </button>
        <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error ?? "Order not found."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/orders")}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to orders
      </button>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">{order.name}</h1>
        {order.financialStatus && (
          <Badge tone={FINANCIAL_TONE[order.financialStatus] ?? "neutral"}>
            {order.financialStatus.replace(/_/g, " ")}
          </Badge>
        )}
        {order.fulfillmentStatus && (
          <Badge tone={FULFILLMENT_TONE[order.fulfillmentStatus] ?? "neutral"}>
            {order.fulfillmentStatus.replace(/_/g, " ")}
          </Badge>
        )}
        {order.cancelledAt && <Badge tone="danger">cancelled</Badge>}
      </div>
      <p className="mb-6 text-sm text-muted">
        Placed {new Date(order.shopifyCreatedAt).toLocaleString()}
        {order.cancelledAt && ` · Cancelled ${new Date(order.cancelledAt).toLocaleString()}`}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardContent className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((item, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="flex items-center gap-3 px-4 py-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.title} className="h-9 w-9 rounded-md object-cover" />
                      ) : (
                        <div className="h-9 w-9 flex-shrink-0 rounded-md bg-background" />
                      )}
                      <span className="font-medium text-foreground">{item.title}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.quantity}</td>
                    <td className="px-4 py-3 text-muted">
                      {order.currency} {item.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {order.currency} {(item.price * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="space-y-2 pt-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="text-foreground">
                {order.currency} {order.subtotalPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Discounts</span>
              <span className="text-foreground">
                -{order.currency} {order.totalDiscounts.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-medium">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">
                {order.currency} {order.totalPrice.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
