"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Send, X } from "lucide-react";
import { LAUNCHER_ICONS } from "@/components/chatbot/launcher-icon";
import type {
  ChatbotTone,
  LauncherIcon,
  LauncherPosition,
  ChatbotThemeMode,
} from "@/features/chatbot/types";

interface PublicChatbotConfig {
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
}

interface ProductRef {
  shopifyProductId: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  url: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  products?: ProductRef[];
}

const LAUNCHER_SIZE = 64;

function postToParent(payload: Record<string, unknown>) {
  if (window.parent !== window) {
    window.parent.postMessage({ source: "cartpilot-widget", ...payload }, "*");
  }
}

function getVisitorId(): string {
  const key = "cartpilot_visitor_id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    // localStorage unavailable (e.g. third-party cookie/storage blocking) — fall back to an
    // ephemeral per-load id rather than crashing the widget.
    return crypto.randomUUID();
  }
}

export default function WidgetPage() {
  const params = useParams<{ storeId: string }>();
  const searchParams = useSearchParams();
  const storeId = params.storeId;
  // Used to embed the real widget directly inside the merchant dashboard (Settings → test
  // panel) rather than via the loader-script + launcher-bubble flow real shoppers see: the host
  // page sizes the iframe itself, so there's no launcher to click and no postMessage resize to
  // listen for.
  const isInlineEmbed = searchParams.get("embed") === "inline";

  const [config, setConfig] = useState<PublicChatbotConfig | null>(null);
  const [notPublished, setNotPublished] = useState(false);
  const [isOpen, setIsOpen] = useState(isInlineEmbed);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const visitorIdRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    visitorIdRef.current = getVisitorId();

    // This page only ever renders inside the widget iframe, alone — make its own html/body
    // fill the iframe viewport and have no background, independent of the shared app layout's
    // styling (which deliberately doesn't force html/body to 100% height globally).
    const { documentElement, body } = document;
    const previous = {
      htmlHeight: documentElement.style.height,
      bodyHeight: body.style.height,
      bodyMargin: body.style.margin,
      bodyBackground: body.style.background,
    };
    documentElement.style.height = "100%";
    body.style.height = "100%";
    body.style.margin = "0";
    body.style.background = "transparent";
    return () => {
      documentElement.style.height = previous.htmlHeight;
      body.style.height = previous.bodyHeight;
      body.style.margin = previous.bodyMargin;
      body.style.background = previous.bodyBackground;
    };
  }, []);

  useEffect(() => {
    fetch(`/api/chatbot/public-config?storeId=${encodeURIComponent(storeId)}`)
      .then(async (res) => {
        if (!res.ok) {
          setNotPublished(true);
          postToParent({ type: "ready", published: false });
          return;
        }
        const body = await res.json();
        const cfg: PublicChatbotConfig = body.data;
        setConfig(cfg);
        setMessages([{ role: "assistant", content: cfg.welcomeMessage }]);
        postToParent({ type: "ready", published: true, position: cfg.launcherPosition });
      })
      .catch(() => {
        setNotPublished(true);
        postToParent({ type: "ready", published: false });
      });
  }, [storeId]);

  useEffect(() => {
    if (!config) return;
    postToParent({
      type: "resize",
      isOpen,
      width: isOpen ? config.panelWidth : LAUNCHER_SIZE,
      height: isOpen ? config.panelHeight : LAUNCHER_SIZE,
    });
  }, [isOpen, config]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (notPublished || !config) {
    return null;
  }

  const Icon = LAUNCHER_ICONS[config.launcherIcon];
  const isDark = config.themeMode === "dark";
  const panelBg = isDark ? "#1E1D1B" : "#FFFFFF";
  const panelText = isDark ? "#F2F1EF" : "#1A1917";
  const panelMuted = isDark ? "#9A988F" : "#6E6D6A";
  const panelBorder = isDark ? "#333230" : "#E4E3E0";

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, visitorId: visitorIdRef.current, message: trimmed }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: body.data.reply, products: body.data.products },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, something went wrong. Please try again." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the server. Please try again." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label={`Open ${config.botName} chat`}
        style={{ backgroundColor: config.brandColor, color: config.textColor }}
        className="flex h-16 w-16 items-center justify-center rounded-full shadow-lg"
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden rounded-xl shadow-lg"
      style={{ backgroundColor: panelBg }}
    >
      <div
        className="flex items-center justify-between gap-2.5 px-4 py-3"
        style={{ backgroundColor: config.brandColor, color: config.textColor }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="truncate text-sm font-semibold">{config.botName}</p>
        </div>
        {!isInlineEmbed && (
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
            className="focus-ring rounded-full p-1 opacity-80 hover:opacity-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ color: panelText }}>
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[85%] space-y-2">
              <div
                className="rounded-xl px-3 py-2 text-sm"
                style={{
                  backgroundColor:
                    msg.role === "user" ? config.brandColor : isDark ? "#282724" : "#F2F1EF",
                  color: msg.role === "user" ? config.textColor : panelText,
                }}
              >
                {msg.content}
              </div>
              {msg.products && msg.products.length > 0 && (
                <div className="space-y-2">
                  {msg.products.map((product) => (
                    <a
                      key={product.shopifyProductId}
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg border p-2 hover:opacity-80"
                      style={{ borderColor: panelBorder }}
                    >
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt={product.title} className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 flex-shrink-0 rounded-md" style={{ backgroundColor: panelBorder }} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{product.title}</p>
                        {product.price !== null && (
                          <p className="text-xs" style={{ color: panelMuted }}>
                            ${product.price.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {messages.length === 1 && config.suggestedPrompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {config.suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="rounded-full border px-2.5 py-1 text-xs"
                style={{ borderColor: panelBorder, color: panelMuted }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-center gap-2 border-t px-3 py-2.5"
        style={{ borderColor: panelBorder }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={isSending}
          className="flex-1 truncate rounded-full border bg-transparent px-3 py-1.5 text-xs focus:outline-none"
          style={{ borderColor: panelBorder, color: panelText }}
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          aria-label="Send message"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-50"
          style={{ backgroundColor: config.brandColor, color: config.textColor }}
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
