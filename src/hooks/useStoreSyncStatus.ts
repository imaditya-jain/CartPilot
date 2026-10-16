import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchStores } from "@/features/stores/storesThunks";
import { selectStores } from "@/features/stores/storesSelectors";
import { apiRequest, ApiClientError } from "@/lib/api-client";

const POLL_INTERVAL_MS = 2500;

/**
 * Tracks one store's sync state and exposes a trigger-sync action. While syncing, polls
 * GET /api/stores (via the shared stores slice, so the store selector badge stays in sync too)
 * until the backend reports completion, then calls onSyncComplete once so callers can refetch
 * whatever list they're showing (products/orders) without polling that themselves.
 */
export function useStoreSyncStatus(storeId: string | undefined, onSyncComplete?: () => void) {
  const dispatch = useAppDispatch();
  const stores = useAppSelector(selectStores);
  const store = stores.find((s) => s.id === storeId) ?? null;

  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const wasSyncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSyncing = store?.syncStatus === "syncing";

  useEffect(() => {
    if (isSyncing && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        dispatch(fetchStores());
      }, POLL_INTERVAL_MS);
    }
    if (!isSyncing && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSyncing, dispatch]);

  useEffect(() => {
    if (wasSyncingRef.current && !isSyncing) {
      onSyncComplete?.();
    }
    wasSyncingRef.current = isSyncing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing]);

  const triggerSync = useCallback(async () => {
    if (!storeId) return;
    setTriggerError(null);
    setIsTriggering(true);
    try {
      await apiRequest("/api/shopify/sync", { method: "POST", body: { storeId } });
      await dispatch(fetchStores());
    } catch (error) {
      setTriggerError(error instanceof ApiClientError ? error.message : "Failed to start sync.");
    } finally {
      setIsTriggering(false);
    }
  }, [storeId, dispatch]);

  return { store, isSyncing, isTriggering, triggerError, triggerSync };
}
