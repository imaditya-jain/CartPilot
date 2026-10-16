export type ChatbotTone = "friendly" | "professional" | "concise" | "enthusiastic";
export type LauncherPosition = "bottom-right" | "bottom-left";
export type LauncherIcon = "message" | "sparkles" | "bot" | "shopping-bag" | "help-circle";
export type ChatbotThemeMode = "light" | "dark";

export interface ChatbotConfig {
  storeId: string;
  botName: string;
  welcomeMessage: string;
  tone: ChatbotTone;
  brandColor: string;
  textColor: string;
  themeMode: ChatbotThemeMode;
  launcherPosition: LauncherPosition;
  launcherIcon: LauncherIcon;
  panelWidth: number;
  panelHeight: number;
  suggestedPrompts: string[];
  productRecommendationsEnabled: boolean;
  offersEnabled: boolean;
  enabled: boolean;
}
