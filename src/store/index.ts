import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/authSlice";
import storesReducer from "@/features/stores/storesSlice";
import analyticsReducer from "@/features/analytics/analyticsSlice";
import chatbotReducer from "@/features/chatbot/chatbotSlice";

const rootReducer = combineReducers({
  auth: authReducer,
  stores: storesReducer,
  analytics: analyticsReducer,
  chatbot: chatbotReducer,
});

export function makeStore() {
  return configureStore({
    reducer: rootReducer,
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
