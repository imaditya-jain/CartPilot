import { getServerEnv, isAiConfigured } from "@/lib/env";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { AiAudit, type AiAuditOperation, type AiAuditStatus } from "@/models/AiAudit";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI insights are not configured — NVIDIA_API_KEY is not set.");
  }
}

export class AiProviderError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

interface AiAuditContext {
  storeId: string;
  tenantId: string;
  operation: AiAuditOperation;
}

type ChatMessage = { role: string; content: string };

async function recordAiAudit(input: {
  context: AiAuditContext;
  model: string;
  generationConfig: { temperature: number; maxTokens: number; enableThinking: boolean };
  status: AiAuditStatus;
  messages: ChatMessage[];
  output: string | null;
  errorMessage: string | null;
  providerStatus: number | null;
  durationMs: number;
}): Promise<void> {
  try {
    await connectToDatabase();
    await AiAudit.create({
      tenantId: new Types.ObjectId(input.context.tenantId),
      storeId: new Types.ObjectId(input.context.storeId),
      operation: input.context.operation,
      model: input.model,
      generationConfig: input.generationConfig,
      status: input.status,
      inputMessages: input.messages,
      output: input.output,
      errorMessage: input.errorMessage,
      providerStatus: input.providerStatus,
      durationMs: input.durationMs,
    });
  } catch (error) {
    console.error("Failed to persist AI audit record:", error);
  }
}

// NVIDIA's hosted model can take longer to start generating than a typical API call.
// Keep this below the chat routes' maxDuration so the request can return a useful fallback.
const REQUEST_TIMEOUT_MS = 55_000;

/**
 * Calls the NVIDIA API Catalog's OpenAI-compatible chat completions endpoint and returns the raw
 * assistant message content. Callers are responsible for parsing/validating that content —
 * this layer only handles the HTTP/timeout/auth boundary, never business logic.
 */
export async function callNvidiaChat(
  messages: ChatMessage[],
  options: { maxTokens?: number; timeoutMs?: number; audit: AiAuditContext }
): Promise<string> {
  const env = getServerEnv();
  const startedAt = Date.now();
  let status: AiAuditStatus = "error";
  let output: string | null = null;
  let errorMessage: string | null = null;
  let providerStatus: number | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    if (!isAiConfigured(env)) {
      status = "not_configured";
      throw new AiNotConfiguredError();
    }

    const response = await fetch(`${env.NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.NVIDIA_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: options.maxTokens ?? 160,
        stream: true,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: controller.signal,
    });

    providerStatus = response.status;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AiProviderError(`NVIDIA API request failed (${response.status}): ${body.slice(0, 200)}`, response.status);
    }

    if (!response.body) {
      throw new AiProviderError("NVIDIA API returned no response stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let content = "";
    let streamFinished = false;

    while (!streamFinished) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data:")) continue;
        const payload = trimmedLine.slice(5).trim();
        if (payload === "[DONE]") {
          streamFinished = true;
          break;
        }
        try {
          const event = JSON.parse(payload);
          const delta = event?.choices?.[0]?.delta?.content;
          if (typeof delta === "string") content += delta;
        } catch {
          // Ignore incomplete or non-JSON SSE lines; the next event can still complete the reply.
        }
      }
    }

    // Some gateways close after the final SSE payload without a trailing newline.
    const finalLine = pending.trim();
    if (finalLine.startsWith("data:")) {
      const payload = finalLine.slice(5).trim();
      if (payload && payload !== "[DONE]") {
        try {
          const event = JSON.parse(payload);
          const delta = event?.choices?.[0]?.delta?.content;
          if (typeof delta === "string") content += delta;
        } catch {
          // Ignore a malformed final event; any complete text already received is still usable.
        }
      }
    }

    if (content.length === 0) {
      throw new AiProviderError("NVIDIA API returned an empty or malformed response.");
    }

    output = content;
    status = "success";
    return content;
  } catch (error) {
    errorMessage = error instanceof Error && error.name === "AbortError"
      ? "NVIDIA API request timed out."
      : error instanceof Error ? error.message : "Unknown AI provider error.";
    if (error instanceof AiProviderError || error instanceof AiNotConfiguredError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiProviderError("NVIDIA API request timed out.");
    }
    throw new AiProviderError(error instanceof Error ? error.message : "Unknown AI provider error.");
  } finally {
    clearTimeout(timeout);
    await recordAiAudit({
      context: options.audit,
      model: env.NVIDIA_MODEL,
      generationConfig: { temperature: 0.2, maxTokens: options.maxTokens ?? 160, enableThinking: false },
      status,
      messages,
      output,
      errorMessage,
      providerStatus,
      durationMs: Date.now() - startedAt,
    });
  }
}
