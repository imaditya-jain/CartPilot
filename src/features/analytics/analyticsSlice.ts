import { createSlice } from "@reduxjs/toolkit";

interface AnalyticsState {
  dateRangeDays: 7 | 30 | 90;
}

const initialState: AnalyticsState = {
  dateRangeDays: 30,
};

const analyticsSlice = createSlice({
  name: "analytics",
  initialState,
  reducers: {
    setDateRangeDays(state, action: { payload: 7 | 30 | 90 }) {
      state.dateRangeDays = action.payload;
    },
  },
});

export const { setDateRangeDays } = analyticsSlice.actions;
export default analyticsSlice.reducer;
