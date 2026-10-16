"use client";

import { useEffect, useState } from "react";
import { UserRound, Sparkles, Tag, Send } from "lucide-react";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CustomerSummary {
  customerId: string;
  email: string | null;
  name: string | null;
  orderCount: number;
  totalSpent: number;
}

interface ProductReference {
  shopifyProductId: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  url: string;
}

interface OfferResult {
  ruleId: string;
  name: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
}

interface TestMessageResponse {
  reply: string;
  products: ProductReference[];
  upsellProducts: ProductReference[];
  bundleProducts: ProductReference[];
  offer: OfferResult | null;
}

function describeOffer(offer: OfferResult): string {
  return offer.discountType === "percentage" ? `${offer.discountValue}% off` : `${offer.discountValue} off`;
}

function ProductRow({ product }: { product: ProductReference }) {
  return (
    <a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-md border border-border p-2 hover:bg-background"
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.title} className="h-9 w-9 rounded-md object-cover" />
      ) : (
        <div className="h-9 w-9 flex-shrink-0 rounded-md bg-background" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{product.title}</p>
        {product.price !== null && <p className="text-xs text-muted">${product.price.toFixed(2)}</p>}
      </div>
    </a>
  );
}

export function ChatbotCustomerTestPanel({ storeId }: { storeId: string }) {
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [message, setMessage] = useState("Can you recommend something for me?");
  const [result, setResult] = useState<TestMessageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    apiRequest<CustomerSummary[]>(`/api/customers?storeId=${storeId}`)
      .then((data) => {
        setCustomers(data);
        if (data[0]) setCustomerId(data[0].customerId);
      })
      .catch(() => setCustomers([]));
  }, [storeId]);

  const sendTestMessage = async () => {
    if (!customerId || !message.trim()) return;
    setIsSending(true);
    setError(null);
    setResult(null);
    setRedeemedCode(null);
    setRedeemError(null);
    try {
      const data = await apiRequest<TestMessageResponse>("/api/chatbot/test-message", {
        method: "POST",
        body: { storeId, customerId, message },
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't reach the test endpoint.");
    } finally {
      setIsSending(false);
    }
  };

  const createDiscountCode = async () => {
    if (!result?.offer) return;
    setIsRedeeming(true);
    setRedeemError(null);
    try {
      const data = await apiRequest<{ code: string }>("/api/discounts/redeem", {
        method: "POST",
        body: { storeId, ruleId: result.offer.ruleId, customerId },
      });
      setRedeemedCode(data.code);
    } catch (err) {
      setRedeemError(err instanceof ApiClientError ? err.message : "Couldn't create the discount code.");
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted" aria-hidden="true" />
          <CardTitle>Test as a customer</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Simulates a chat as a real synced customer — recommendations and offers use their actual order
          history. This never touches live shopper traffic.
        </p>

        {customers === null ? (
          <div className="h-10 animate-pulse rounded-md bg-background" />
        ) : customers.length === 0 ? (
          <p className="text-sm text-muted">No synced customers yet — sync orders with customer data first.</p>
        ) : (
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.customerId} value={c.customerId}>
                {c.name ?? c.email ?? c.customerId} · {c.orderCount} orders · ${c.totalSpent.toFixed(2)} spent
              </option>
            ))}
          </Select>
        )}

        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a shopper message…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendTestMessage();
              }
            }}
          />
          <Button type="button" variant="secondary" isLoading={isSending} disabled={!customerId} onClick={sendTestMessage}>
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {result && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-sm text-foreground">{result.reply}</p>

            {result.products.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Product suggestions</p>
                <div className="space-y-1.5">
                  {result.products.map((product) => (
                    <ProductRow key={product.shopifyProductId} product={product} />
                  ))}
                </div>
              </div>
            )}

            {result.upsellProducts.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Upsell suggestions
                </p>
                <div className="space-y-1.5">
                  {result.upsellProducts.map((p) => (
                    <ProductRow key={p.shopifyProductId} product={p} />
                  ))}
                </div>
              </div>
            )}

            {result.bundleProducts.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Frequently bought together</p>
                <div className="space-y-1.5">
                  {result.bundleProducts.map((p) => (
                    <ProductRow key={p.shopifyProductId} product={p} />
                  ))}
                </div>
              </div>
            )}

            {result.offer && (
              <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">
                    Offer: {result.offer.name} — {describeOffer(result.offer)}
                  </p>
                </div>
                {redeemedCode ? (
                  <Badge tone="success">Created: {redeemedCode}</Badge>
                ) : (
                  <Button type="button" size="sm" variant="secondary" isLoading={isRedeeming} onClick={createDiscountCode}>
                    Create discount code in Shopify
                  </Button>
                )}
                {redeemError && <p className="text-sm text-danger">{redeemError}</p>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
