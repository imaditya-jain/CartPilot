import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest } from "@/lib/api-client";
import type { StoreSummary } from "@/features/stores/types";

export const fetchStores = createAsyncThunk<StoreSummary[]>("stores/fetchAll", async () => {
  const { stores } = await apiRequest<{ stores: StoreSummary[] }>("/api/stores");
  return stores;
});
