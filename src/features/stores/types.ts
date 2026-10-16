export type StoreConnectionStatus = "pending" | "connected" | "disconnected" | "error";
export type StoreSyncStatus = "idle" | "syncing" | "error";

export interface StoreSummary {
  id: string;
  shopDomain: string;
  connectionStatus: StoreConnectionStatus;
  syncStatus: StoreSyncStatus;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  productCount: number;
  orderCount: number;
  lastWidgetPingAt: string | null;
}
