"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Store as StoreIcon, Plug, RefreshCw, Unplug, KeyRound } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchStores } from "@/features/stores/storesThunks";
import { selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import { shopDomainSchema } from "@/lib/validation/shopify";

const CONNECTION_TONE = {
  connected: "success",
  pending: "warning",
  disconnected: "neutral",
  error: "danger",
} as const;

function ConnectStoreForm() {
  const [shop, setShop] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = shopDomainSchema.safeParse(shop);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid shop domain.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    window.location.href = `/api/shopify/connect?shop=${encodeURIComponent(result.data)}`;
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="shop">Shopify store domain</Label>
        <Input
          id="shop"
          placeholder="your-store.myshopify.com"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          hasError={!!error}
        />
        <FieldError>{error ?? undefined}</FieldError>
      </div>
      <Button type="submit" isLoading={isSubmitting}>
        <Plug className="h-4 w-4" aria-hidden="true" />
        Connect store
      </Button>
    </form>
  );
}

function DevConnectForm({ onConnected }: { onConnected: () => void }) {
  const [shop, setShop] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const shopResult = shopDomainSchema.safeParse(shop);
    if (!shopResult.success) {
      setError(shopResult.error.issues[0]?.message ?? "Enter a valid shop domain.");
      return;
    }
    if (!accessToken.trim()) {
      setError("Access token is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiRequest<{ shopName: string }>("/api/shopify/connect-dev", {
        method: "POST",
        body: { shop: shopResult.data, accessToken: accessToken.trim() },
      });
      setSuccess(`Connected to ${result.shopName}.`);
      setAccessToken("");
      onConnected();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to connect.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-6 border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted" aria-hidden="true" />
          <CardTitle>Developer: connect via access token (local only)</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted">
          For local testing without a public URL. In your store&apos;s admin, go to{" "}
          <span className="font-medium text-foreground">
            Settings → Apps and sales channels → Develop apps
          </span>
          , create an app, grant it <code className="text-xs">read_products</code> and{" "}
          <code className="text-xs">read_orders</code>, install it, then paste the Admin API
          access token below. This endpoint is disabled outside local development.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="dev-shop">Shop domain</Label>
            <Input
              id="dev-shop"
              placeholder="your-store.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="dev-token">Admin API access token</Label>
            <Input
              id="dev-token"
              type="password"
              placeholder="shpat_..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" isLoading={isSubmitting}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Connect
          </Button>
        </form>
        {error && <FieldError>{error}</FieldError>}
        {success && <p className="mt-1.5 text-sm text-success">{success}</p>}
      </CardContent>
    </Card>
  );
}

export default function StoresPage() {
  return (
    <Suspense fallback={null}>
      <StoresPageContent />
    </Suspense>
  );
}

function StoresPageContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stores = useAppSelector(selectStores);
  const status = useAppSelector(selectStoresStatus);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingStoreId, setPendingStoreId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchStores());
  }, [dispatch]);

  useEffect(() => {
    if (searchParams.get("shopify")) {
      router.replace("/stores");
    }
  }, [searchParams, router]);

  const shopifyStatus = searchParams.get("shopify");
  const shopifyMessage = searchParams.get("message");

  const handleSync = async (storeId: string) => {
    setActionError(null);
    setPendingStoreId(storeId);
    try {
      await apiRequest("/api/shopify/sync", { method: "POST", body: { storeId } });
      dispatch(fetchStores());
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : "Failed to start sync.");
    } finally {
      setPendingStoreId(null);
    }
  };

  const handleDisconnect = async (storeId: string) => {
    setActionError(null);
    setPendingStoreId(storeId);
    try {
      await apiRequest("/api/shopify/disconnect", { method: "POST", body: { storeId } });
      dispatch(fetchStores());
    } catch (error) {
      setActionError(error instanceof ApiClientError ? error.message : "Failed to disconnect store.");
    } finally {
      setPendingStoreId(null);
    }
  };

  return (
    <div>
      <PageHeader title="Stores" description="Connect and manage your Shopify stores." />

      {shopifyStatus === "connected" && (
        <div className="mb-4 rounded-md border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">
          Store connected successfully.
        </div>
      )}
      {shopifyStatus === "error" && (
        <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {shopifyMessage ?? "Failed to connect store."}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {actionError}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connect a new store</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectStoreForm />
        </CardContent>
      </Card>

      <DevConnectForm onConnected={() => dispatch(fetchStores())} />

      {status === "succeeded" && stores.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="No stores connected yet"
          description="Enter your Shopify store domain above to start the connection."
        />
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <Card key={store.id}>
              <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{store.shopDomain}</span>
                    <Badge tone={CONNECTION_TONE[store.connectionStatus]}>{store.connectionStatus}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {store.lastSyncedAt
                      ? `Last synced ${new Date(store.lastSyncedAt).toLocaleString()}`
                      : "Never synced"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={store.connectionStatus !== "connected" || pendingStoreId === store.id}
                    isLoading={pendingStoreId === store.id}
                    onClick={() => handleSync(store.id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Sync now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={store.connectionStatus === "disconnected" || pendingStoreId === store.id}
                    onClick={() => handleDisconnect(store.id)}
                  >
                    <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
