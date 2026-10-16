"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchStores } from "@/features/stores/storesThunks";
import { setActiveStore } from "@/features/stores/storesSlice";
import { selectActiveStore, selectStores, selectStoresStatus } from "@/features/stores/storesSelectors";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE = {
  connected: "success",
  pending: "warning",
  disconnected: "neutral",
  error: "danger",
} as const;

export function StoreSelector() {
  const dispatch = useAppDispatch();
  const stores = useAppSelector(selectStores);
  const activeStore = useAppSelector(selectActiveStore);
  const status = useAppSelector(selectStoresStatus);

  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchStores());
    }
  }, [dispatch, status]);

  if (status === "succeeded" && stores.length === 0) {
    return (
      <Link
        href="/stores"
        className="focus-ring flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Connect a store
      </Link>
    );
  }

  if (!activeStore) {
    return <div className="h-8 w-40 animate-pulse rounded-md bg-background" aria-hidden="true" />;
  }

  return (
    <div className="relative">
      <label htmlFor="store-selector" className="sr-only">
        Select store
      </label>
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
        <select
          id="store-selector"
          value={activeStore.id}
          onChange={(event) => dispatch(setActiveStore(event.target.value))}
          className="focus-ring appearance-none bg-transparent pr-6 text-sm font-medium text-foreground"
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.shopDomain}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none -ml-5 h-3.5 w-3.5 text-muted" aria-hidden="true" />
        <Badge tone={STATUS_TONE[activeStore.connectionStatus]}>{activeStore.connectionStatus}</Badge>
      </div>
    </div>
  );
}
