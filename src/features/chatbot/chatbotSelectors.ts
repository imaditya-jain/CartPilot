import type { RootState } from "@/store";

export const selectChatbotConfig = (state: RootState) => state.chatbot.config;
export const selectChatbotStatus = (state: RootState) => state.chatbot.status;
export const selectChatbotSaveStatus = (state: RootState) => state.chatbot.saveStatus;
export const selectChatbotError = (state: RootState) => state.chatbot.error;
