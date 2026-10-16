import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { chatbotConfigSchema } from "@/lib/validation/chatbot";
import { getOrCreateChatbotConfig, updateChatbotConfig } from "@/services/chatbot-config-service";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

function serialize(config: Awaited<ReturnType<typeof getOrCreateChatbotConfig>>) {
  return {
    storeId: config.storeId.toString(),
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
    enabled: config.enabled,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) {
      return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");
    }

    const config = await getOrCreateChatbotConfig(storeId, auth.userId);
    return ok(serialize(config));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const body = await request.json();
    const input = chatbotConfigSchema.parse(body);

    const config = await updateChatbotConfig(input, auth.userId);
    return ok(serialize(config));
  } catch (error) {
    return handleApiError(error);
  }
}
