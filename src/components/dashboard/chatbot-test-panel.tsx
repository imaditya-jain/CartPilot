"use client";

import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChatbotTestPanel({ storeId, enabled }: { storeId: string; enabled: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted" aria-hidden="true" />
          <CardTitle>Test chat (in-app)</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <iframe
            key={storeId}
            src={`/widget/${storeId}?embed=inline`}
            title="Chatbot test panel"
            className="h-[560px] w-full rounded-lg border border-border"
          />
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted">
            Turn on &ldquo;Publish chatbot on storefront&rdquo; above and save to chat with it here —
            this panel shows exactly what a shopper would see, so it respects the same publish
            setting.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
