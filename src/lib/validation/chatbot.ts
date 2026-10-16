import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Enter a valid hex color, e.g. #141413");

export const chatbotConfigSchema = z.object({
  storeId: z.string().min(1, "storeId is required"),
  botName: z.string().trim().min(1, "Bot name is required").max(40, "Bot name is too long"),
  welcomeMessage: z.string().trim().min(1, "Welcome message is required").max(280, "Welcome message is too long"),
  tone: z.enum(["friendly", "professional", "concise", "enthusiastic"]),
  brandColor: hexColor,
  textColor: hexColor,
  themeMode: z.enum(["light", "dark"]),
  launcherPosition: z.enum(["bottom-right", "bottom-left"]),
  launcherIcon: z.enum(["message", "sparkles", "bot", "shopping-bag", "help-circle"]),
  panelWidth: z.coerce.number().int().min(320).max(480),
  panelHeight: z.coerce.number().int().min(420).max(720),
  suggestedPrompts: z.array(z.string().trim().min(1).max(60)).max(5, "Up to 5 suggested prompts"),
  productRecommendationsEnabled: z.boolean(),
  offersEnabled: z.boolean(),
  enabled: z.boolean(),
});
export type ChatbotConfigInput = z.infer<typeof chatbotConfigSchema>;
