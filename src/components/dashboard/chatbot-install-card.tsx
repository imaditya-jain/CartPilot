"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppSelector } from "@/store/hooks";
import { selectStores } from "@/features/stores/storesSelectors";

const WIDGET_ACTIVE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function ChatbotInstallCard({ storeId }: { storeId: string }) {
  const [copied, setCopied] = useState(false);
  const store = useAppSelector(selectStores).find((s) => s.id === storeId);
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<script src="${appOrigin}/chatbot/loader.js" data-store-id="${storeId}" async></script>`;

  const lastPing = store?.lastWidgetPingAt ? new Date(store.lastWidgetPingAt) : null;
  const isActive = lastPing !== null && Date.now() - lastPing.getTime() < WIDGET_ACTIVE_WINDOW_MS;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browsers, permissions) — the snippet is still
      // visible and selectable, so this just skips the one-click convenience.
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle>Installation</CardTitle>
            <Badge tone={isActive ? "success" : lastPing ? "warning" : "neutral"}>
              {isActive ? "Active" : lastPing ? "Inactive" : "Not detected yet"}
            </Badge>
          </div>
          <a href={`/widget-preview/${storeId}`} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="secondary">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Test chat widget
            </Button>
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted">
          The button above opens a mock storefront page with the widget loaded exactly as a real
          shopper would see it — try asking it about a product in your catalog. It uses deterministic
          catalog search today; it does not require the AI provider to be configured. It also sends
          the same heartbeat ping the badge below watches for, so you can confirm that end-to-end
          without ever touching your live theme.
        </p>
        <p className="text-sm text-muted">
          &ldquo;Active&rdquo; means the loader script pinged us within the last 48 hours — either from
          the preview above or from the real snippet once it&apos;s installed on your storefront.
          The chatbot must also be published from Settings before shoppers can open it.
        </p>
        <p className="text-sm text-muted">
          Paste this snippet once, just before <code className="text-xs">&lt;/body&gt;</code> in your
          theme&apos;s <code className="text-xs">theme.liquid</code> file (Online Store → Themes → Edit code).
          The chat button appears on storefront pages where this script is installed after you
          publish it from Settings. Unpublish it there or remove the snippet to hide it. No Shopify
          credentials are exposed to the storefront.
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs text-foreground">
            <code>{snippet}</code>
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy installation snippet"
            className="focus-ring absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
              </>
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
