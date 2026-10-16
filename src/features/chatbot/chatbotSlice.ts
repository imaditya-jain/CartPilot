import { createSlice } from "@reduxjs/toolkit";
import type { ChatbotConfig } from "@/features/chatbot/types";
import { fetchChatbotConfig, saveChatbotConfig } from "@/features/chatbot/chatbotThunks";

interface ChatbotState {
  config: ChatbotConfig | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  saveStatus: "idle" | "saving" | "succeeded" | "failed";
  error: string | null;
}

const initialState: ChatbotState = {
  config: null,
  status: "idle",
  saveStatus: "idle",
  error: null,
};

const chatbotSlice = createSlice({
  name: "chatbot",
  initialState,
  reducers: {
    updateDraftConfig(state, action: { payload: Partial<ChatbotConfig> }) {
      if (state.config) {
        state.config = { ...state.config, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatbotConfig.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchChatbotConfig.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.config = action.payload;
      })
      .addCase(fetchChatbotConfig.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Failed to load chatbot configuration.";
      })
      .addCase(saveChatbotConfig.pending, (state) => {
        state.saveStatus = "saving";
        state.error = null;
      })
      .addCase(saveChatbotConfig.fulfilled, (state, action) => {
        state.saveStatus = "succeeded";
        state.config = action.payload;
      })
      .addCase(saveChatbotConfig.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.error = action.payload ?? "Failed to save chatbot configuration.";
      });
  },
});

export const { updateDraftConfig } = chatbotSlice.actions;
export default chatbotSlice.reducer;
