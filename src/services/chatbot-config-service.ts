import { connectToDatabase } from "@/lib/mongodb";
import { ChatbotConfiguration, type ChatbotConfigurationDocument } from "@/models/ChatbotConfiguration";
import { requireOwnedStore } from "@/services/store-service";
import type { ChatbotConfigInput } from "@/lib/validation/chatbot";

export async function getOrCreateChatbotConfig(
  storeId: string,
  tenantId: string
): Promise<ChatbotConfigurationDocument> {
  await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();

  const existing = await ChatbotConfiguration.findOne({ storeId });
  if (existing) return existing;

  return ChatbotConfiguration.create({ tenantId, storeId });
}

export async function updateChatbotConfig(
  input: ChatbotConfigInput,
  tenantId: string
): Promise<ChatbotConfigurationDocument> {
  const store = await requireOwnedStore(input.storeId, tenantId);
  await connectToDatabase();

  const { storeId, ...fields } = input;
  const config = await ChatbotConfiguration.findOneAndUpdate(
    { storeId: store._id },
    { $set: { ...fields, tenantId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return config;
}

/** Used by the (future) public storefront widget endpoint — never includes tenant/internal fields. */
export async function getPublicChatbotConfig(storeId: string) {
  await connectToDatabase();
  const config = await ChatbotConfiguration.findOne({ storeId, enabled: true });
  if (!config) return null;

  return {
    botName: config.botName,
    welcomeMessage: config.welcomeMessage,
    tone: config.tone,
    brandColor: config.brandColor,
    textColor: config.textColor,
    themeMode: config.themeMode,
    launcherPosition: config.launcherPosition,
    launcherIcon: config.launcherIcon,
    panelWidth: config.panelWidth,
    panelHeight: config.panelHeight,
    suggestedPrompts: config.suggestedPrompts,
    productRecommendationsEnabled: config.productRecommendationsEnabled,
    offersEnabled: config.offersEnabled,
  };
}
