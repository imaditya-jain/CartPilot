"use client";

import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ChatbotSettingsForm } from "@/components/dashboard/chatbot-settings-form";
import { DiscountRulesManager } from "@/components/dashboard/discount-rules-manager";
import { useAppSelector } from "@/store/hooks";
import { selectActiveStore, selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { Store as StoreIcon } from "lucide-react";

export default function SettingsPage() {
  const stores = useAppSelector(selectStores);
  const storesStatus = useAppSelector(selectStoresStatus);
  const activeStore = useAppSelector(selectActiveStore);

  return (
    <div>
      <PageHeader title="Settings" description="Chatbot appearance, tone, and behavior for the selected store." />

      {storesStatus === "succeeded" && stores.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="Connect a store to configure its chatbot"
          description="Chatbot settings are per-store — connect a Shopify store first."
          action={
            <Link href="/stores">
              <Button size="sm">Connect store</Button>
            </Link>
          }
        />
      ) : activeStore ? (
        <div className="space-y-6">
          <ChatbotSettingsForm storeId={activeStore.id} />
          <DiscountRulesManager storeId={activeStore.id} />
        </div>
      ) : (
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      )}
    </div>
  );
}
