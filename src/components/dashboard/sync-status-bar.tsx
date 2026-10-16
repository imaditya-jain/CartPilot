"use client";

import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStoreSyncStatus } from "@/hooks/useStoreSyncStatus";

const SYNC_TONE = {
  idle: "neutral",
  syncing: "warning",
  error: "danger",
} as const;

export function SyncStatusBar({
  storeId,
  onSyncComplete,
  countLabel,
  className,
}: {
  storeId: string | undefined;
  onSyncComplete?: () => void;
  countLabel?: string;
  className?: string;
}) {
  const { store, isSyncing, isTriggering, triggerError, triggerSync } = useStoreSyncStatus(
    storeId,
    onSyncComplete
  );

  if (!store) return null;

  return (
    <div
      className={`${className ?? "mb-4"} flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex items-center gap-2.5 text-sm">
        <Badge tone={SYNC_TONE[store.syncStatus]}>
          {isSyncing && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {store.syncStatus === "syncing" ? "Syncing…" : store.syncStatus === "error" ? "Sync failed" : "Synced"}
        </Badge>
        <span className="text-muted">
          {store.lastSyncedAt
            ? `Last synced ${new Date(store.lastSyncedAt).toLocaleString()}`
            : "Never synced"}
          {countLabel ? ` · ${countLabel}` : ""}
        </span>
        {store.syncStatus === "error" && store.lastSyncError && (
          <span className="text-danger">({store.lastSyncError})</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {triggerError && <span className="text-sm text-danger">{triggerError}</span>}
        <Button
          size="sm"
          variant="secondary"
          disabled={isSyncing || isTriggering}
          isLoading={isTriggering}
          onClick={triggerSync}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Sync now
        </Button>
      </div>
    </div>
  );
}
