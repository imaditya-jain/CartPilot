"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X, Check } from "lucide-react";
import { chatbotConfigSchema, type ChatbotConfigInput } from "@/lib/validation/chatbot";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchChatbotConfig, saveChatbotConfig } from "@/features/chatbot/chatbotThunks";
import {
  selectChatbotConfig,
  selectChatbotSaveStatus,
  selectChatbotStatus,
} from "@/features/chatbot/chatbotSelectors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChatWidgetPreview } from "@/components/chatbot/chat-widget-preview";
import { ChatbotTestPanel } from "@/components/dashboard/chatbot-test-panel";
import { ChatbotCustomerTestPanel } from "@/components/dashboard/chatbot-customer-test-panel";
import { ChatbotInstallCard } from "@/components/dashboard/chatbot-install-card";
import { LAUNCHER_ICONS, LAUNCHER_ICON_LABELS } from "@/components/chatbot/launcher-icon";
import { meetsAccessibleContrast } from "@/lib/utils/color-contrast";
import { cn } from "@/lib/utils/cn";
import type { LauncherIcon, LauncherPosition, ChatbotThemeMode } from "@/features/chatbot/types";

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "concise", label: "Concise" },
  { value: "enthusiastic", label: "Enthusiastic" },
] as const;

export function ChatbotSettingsForm({ storeId }: { storeId: string }) {
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectChatbotConfig);
  const status = useAppSelector(selectChatbotStatus);
  const saveStatus = useAppSelector(selectChatbotSaveStatus);
  const [savedMessage, setSavedMessage] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ChatbotConfigInput>({ resolver: zodResolver(chatbotConfigSchema) });

  useEffect(() => {
    dispatch(fetchChatbotConfig(storeId));
  }, [dispatch, storeId]);

  useEffect(() => {
    if (config) reset(config);
  }, [config, reset]);

  const values = watch();

  const onSubmit = async (input: ChatbotConfigInput) => {
    setSavedMessage(false);
    const result = await dispatch(saveChatbotConfig(input));
    if (saveChatbotConfig.fulfilled.match(result)) {
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
    }
  };

  if (status === "loading" || !config || !values.botName) {
    return <div className="h-64 animate-pulse rounded-lg bg-surface" />;
  }

  const prompts = values.suggestedPrompts ?? [];
  const contrastOk = meetsAccessibleContrast(values.brandColor || "#000000", values.textColor || "#ffffff");

  const addPrompt = () => {
    const trimmed = newPrompt.trim();
    if (!trimmed || prompts.length >= 5) return;
    setValue("suggestedPrompts", [...prompts, trimmed], { shouldDirty: true });
    setNewPrompt("");
  };

  const removePrompt = (index: number) => {
    setValue(
      "suggestedPrompts",
      prompts.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <input type="hidden" {...register("storeId")} />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="botName">Bot display name</Label>
              <Input id="botName" hasError={!!errors.botName} {...register("botName")} />
              <FieldError>{errors.botName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="welcomeMessage">Welcome message</Label>
              <Textarea id="welcomeMessage" rows={3} hasError={!!errors.welcomeMessage} {...register("welcomeMessage")} />
              <FieldError>{errors.welcomeMessage?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="tone">Assistant tone</Label>
              <Select id="tone" {...register("tone")}>
                {TONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <Controller
              control={control}
              name="enabled"
              render={({ field }) => (
                <Switch
                  id="enabled"
                  checked={field.value}
                  onChange={field.onChange}
                  label="Publish chatbot on storefront"
                  description="When off, the widget won't load for shoppers even if embedded."
                />
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brandColor">Brand color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Brand color picker"
                    className="h-10 w-10 flex-shrink-0 cursor-pointer rounded-md border border-border"
                    value={/^#([0-9a-fA-F]{6})$/.test(values.brandColor) ? values.brandColor : "#141413"}
                    onChange={(e) => setValue("brandColor", e.target.value, { shouldDirty: true })}
                  />
                  <Input id="brandColor" hasError={!!errors.brandColor} {...register("brandColor")} />
                </div>
                <FieldError>{errors.brandColor?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="textColor">Text on brand color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Text color picker"
                    className="h-10 w-10 flex-shrink-0 cursor-pointer rounded-md border border-border"
                    value={/^#([0-9a-fA-F]{6})$/.test(values.textColor) ? values.textColor : "#ffffff"}
                    onChange={(e) => setValue("textColor", e.target.value, { shouldDirty: true })}
                  />
                  <Input id="textColor" hasError={!!errors.textColor} {...register("textColor")} />
                </div>
                <FieldError>{errors.textColor?.message}</FieldError>
              </div>
            </div>
            {!contrastOk && (
              <p className="text-sm text-warning">
                This color pair is below the WCAG AA contrast minimum (4.5:1) — the header text may be
                hard to read.
              </p>
            )}

            <div>
              <Label>Launcher icon</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LAUNCHER_ICONS) as LauncherIcon[]).map((icon) => {
                  const Icon = LAUNCHER_ICONS[icon];
                  const isSelected = values.launcherIcon === icon;
                  return (
                    <button
                      key={icon}
                      type="button"
                      aria-label={LAUNCHER_ICON_LABELS[icon]}
                      aria-pressed={isSelected}
                      onClick={() => setValue("launcherIcon", icon, { shouldDirty: true })}
                      className={cn(
                        "focus-ring flex h-10 w-10 items-center justify-center rounded-md border",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Launcher position</Label>
                <div className="flex gap-2">
                  {(["bottom-left", "bottom-right"] as LauncherPosition[]).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      aria-pressed={values.launcherPosition === pos}
                      onClick={() => setValue("launcherPosition", pos, { shouldDirty: true })}
                      className={cn(
                        "focus-ring flex-1 rounded-md border px-3 py-2 text-sm",
                        values.launcherPosition === pos
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted"
                      )}
                    >
                      {pos === "bottom-left" ? "Bottom left" : "Bottom right"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Panel theme</Label>
                <div className="flex gap-2">
                  {(["light", "dark"] as ChatbotThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={values.themeMode === mode}
                      onClick={() => setValue("themeMode", mode, { shouldDirty: true })}
                      className={cn(
                        "focus-ring flex-1 rounded-md border px-3 py-2 text-sm capitalize",
                        values.themeMode === mode
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="panelWidth">Panel width ({values.panelWidth}px)</Label>
                <input
                  id="panelWidth"
                  type="range"
                  min={320}
                  max={480}
                  step={10}
                  value={values.panelWidth}
                  onChange={(e) => setValue("panelWidth", Number(e.target.value), { shouldDirty: true })}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
              <div>
                <Label htmlFor="panelHeight">Panel height ({values.panelHeight}px)</Label>
                <input
                  id="panelHeight"
                  type="range"
                  min={420}
                  max={720}
                  step={10}
                  value={values.panelHeight}
                  onChange={(e) => setValue("panelHeight", Number(e.target.value), { shouldDirty: true })}
                  className="w-full accent-[var(--color-primary)]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Behavior</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Suggested prompts (up to 5)</Label>
              <div className="mb-2 flex flex-wrap gap-2">
                {prompts.map((prompt, index) => (
                  <span
                    key={`${prompt}-${index}`}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground"
                  >
                    {prompt}
                    <button
                      type="button"
                      onClick={() => removePrompt(index)}
                      aria-label={`Remove prompt: ${prompt}`}
                      className="focus-ring rounded-full text-muted hover:text-danger"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
              {prompts.length < 5 && (
                <div className="flex gap-2">
                  <Input
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="e.g. Help me find a gift"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPrompt();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addPrompt}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add
                  </Button>
                </div>
              )}
              <FieldError>{errors.suggestedPrompts?.message}</FieldError>
            </div>

            <Controller
              control={control}
              name="productRecommendationsEnabled"
              render={({ field }) => (
                <Switch
                  id="productRecommendationsEnabled"
                  checked={field.value}
                  onChange={field.onChange}
                  label="Product recommendations"
                  description="Let the assistant suggest products from the synchronized catalog."
                />
              )}
            />
            <Controller
              control={control}
              name="offersEnabled"
              render={({ field }) => (
                <Switch
                  id="offersEnabled"
                  checked={field.value}
                  onChange={field.onChange}
                  label="Offer eligibility messaging"
                  description="When on, the assistant checks the discount rules below against each shopper's order history and can offer — and create — a real Shopify discount code."
                />
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" isLoading={saveStatus === "saving"} disabled={!isDirty && !savedMessage}>
            Save changes
          </Button>
          {savedMessage && (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check className="h-4 w-4" aria-hidden="true" />
              Saved
            </span>
          )}
          {!config.enabled && <Badge tone="warning">Not published</Badge>}
        </div>

        <ChatbotInstallCard storeId={storeId} />
      </div>

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Live preview</p>
          <ChatWidgetPreview config={values} />
        </div>
        <ChatbotTestPanel storeId={storeId} enabled={config.enabled} />
        <ChatbotCustomerTestPanel storeId={storeId} />
      </div>
    </form>
  );
}
