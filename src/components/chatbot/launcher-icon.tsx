import { MessageCircle, Sparkles, Bot, ShoppingBag, HelpCircle, type LucideIcon } from "lucide-react";
import type { LauncherIcon } from "@/features/chatbot/types";

export const LAUNCHER_ICONS: Record<LauncherIcon, LucideIcon> = {
  message: MessageCircle,
  sparkles: Sparkles,
  bot: Bot,
  "shopping-bag": ShoppingBag,
  "help-circle": HelpCircle,
};

export const LAUNCHER_ICON_LABELS: Record<LauncherIcon, string> = {
  message: "Message bubble",
  sparkles: "Sparkles",
  bot: "Robot",
  "shopping-bag": "Shopping bag",
  "help-circle": "Help",
};
