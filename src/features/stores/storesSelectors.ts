import type { RootState } from "@/store";

export const selectStores = (state: RootState) => state.stores.items;
export const selectActiveStoreId = (state: RootState) => state.stores.activeStoreId;
export const selectActiveStore = (state: RootState) =>
  state.stores.items.find((store) => store.id === state.stores.activeStoreId) ?? null;
export const selectStoresStatus = (state: RootState) => state.stores.status;
