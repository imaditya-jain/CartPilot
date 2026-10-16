import { Send } from "lucide-react";
import type { ChatbotConfig } from "@/features/chatbot/types";
import { LAUNCHER_ICONS } from "@/components/chatbot/launcher-icon";
import { cn } from "@/lib/utils/cn";

/**
 * Renders the chat widget exactly as it will appear to shoppers, driven entirely by a
 * ChatbotConfig. Used for the merchant-facing live preview today; the public embeddable widget
 * (Phase 6 storefront integration) will render this same component against the public config
 * endpoint so the two never visually drift apart.
 */
export function ChatWidgetPreview({ config }: { config: ChatbotConfig }) {
  const Icon = LAUNCHER_ICONS[config.launcherIcon];
  const isDark = config.themeMode === "dark";
  const panelBg = isDark ? "#1E1D1B" : "#FFFFFF";
  const panelText = isDark ? "#F2F1EF" : "#1A1917";
  const panelMuted = isDark ? "#9A988F" : "#6E6D6A";
  const panelBorder = isDark ? "#333230" : "#E4E3E0";
  const alignEnd = config.launcherPosition === "bottom-right";

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Launcher (closed state)</p>
        <div className={cn("flex rounded-lg border border-border bg-[#f4f3f1] p-4", alignEnd ? "justify-end" : "justify-start")}>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full shadow-floating"
            style={{ backgroundColor: config.brandColor, color: config.textColor }}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Open panel</p>
        <div className={cn("flex rounded-lg border border-border bg-[#f4f3f1] p-4", alignEnd ? "justify-end" : "justify-start")}>
          <div
            className="flex flex-col overflow-hidden rounded-xl shadow-floating"
            style={{ width: config.panelWidth, maxWidth: "100%", height: config.panelHeight, backgroundColor: panelBg }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-3"
              style={{ backgroundColor: config.brandColor, color: config.textColor }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{config.botName}</p>
                <p className="truncate text-xs opacity-80">Usually replies in a few seconds</p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ color: panelText }}>
              <div
                className="max-w-[85%] rounded-xl rounded-tl-sm px-3 py-2 text-sm"
                style={{ backgroundColor: isDark ? "#282724" : "#F2F1EF" }}
              >
                {config.welcomeMessage || "Hi! How can I help you today?"}
              </div>

              {config.suggestedPrompts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {config.suggestedPrompts.slice(0, 5).map((prompt) => (
                    <span
                      key={prompt}
                      className="rounded-full border px-2.5 py-1 text-xs"
                      style={{ borderColor: panelBorder, color: panelMuted }}
                    >
                      {prompt}
                    </span>
                  ))}
                </div>
              )}

              {config.productRecommendationsEnabled && (
                <div className="rounded-lg border p-2.5" style={{ borderColor: panelBorder }}>
                  <div className="flex gap-2.5">
                    <div className="h-12 w-12 flex-shrink-0 rounded-md bg-[#e4e3e0]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">Sample recommended product</p>
                      <p className="text-xs" style={{ color: panelMuted }}>
                        $48.00
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: panelBorder }}>
              <div
                className="flex-1 truncate rounded-full border px-3 py-1.5 text-xs"
                style={{ borderColor: panelBorder, color: panelMuted }}
              >
                Ask a question…
              </div>
              <div
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: config.brandColor, color: config.textColor }}
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
