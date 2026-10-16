import { createSlice } from "@reduxjs/toolkit";
import type { StoreSummary } from "@/features/stores/types";
import { fetchStores } from "@/features/stores/storesThunks";

interface StoresState {
  items: StoreSummary[];
  activeStoreId: string | null;
  status: "idle" | "loading" | "succeeded" | "failed";
}

const initialState: StoresState = {
  items: [],
  activeStoreId: null,
  status: "idle",
};

const storesSlice = createSlice({
  name: "stores",
  initialState,
  reducers: {
    setActiveStore(state, action: { payload: string | null }) {
      state.activeStoreId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStores.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchStores.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
        if (!state.activeStoreId && action.payload.length > 0) {
          state.activeStoreId = action.payload[0]?.id ?? null;
        }
      })
      .addCase(fetchStores.rejected, (state) => {
        state.status = "failed";
      });
  },
});

export const { setActiveStore } = storesSlice.actions;
export default storesSlice.reducer;
