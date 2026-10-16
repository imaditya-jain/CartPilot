import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest, ApiClientError } from "@/lib/api-client";
import type { ChatbotConfig } from "@/features/chatbot/types";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback;
}

export const fetchChatbotConfig = createAsyncThunk<ChatbotConfig, string, { rejectValue: string }>(
  "chatbot/fetchConfig",
  async (storeId, { rejectWithValue }) => {
    try {
      return await apiRequest<ChatbotConfig>(`/api/chatbot/config?storeId=${encodeURIComponent(storeId)}`);
    } catch (error) {
      return rejectWithValue(errorMessage(error, "Failed to load chatbot configuration."));
    }
  }
);

export const saveChatbotConfig = createAsyncThunk<ChatbotConfig, ChatbotConfig, { rejectValue: string }>(
  "chatbot/saveConfig",
  async (input, { rejectWithValue }) => {
    try {
      return await apiRequest<ChatbotConfig>("/api/chatbot/config", { method: "PUT", body: input });
    } catch (error) {
      return rejectWithValue(errorMessage(error, "Failed to save chatbot configuration."));
    }
  }
);
