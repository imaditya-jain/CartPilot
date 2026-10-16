import { z } from "zod";

export const aiInsightSchema = z.object({
  summary: z.string().min(1).max(600),
  observations: z.array(z.string().min(1).max(200)).min(1).max(5),
  suggestedActions: z.array(z.string().min(1).max(200)).min(1).max(5),
  alerts: z.array(z.object({
    priority: z.enum(["urgent", "warning", "opportunity"]),
    title: z.string().min(1).max(100),
    detail: z.string().min(1).max(240),
    action: z.string().min(1).max(180),
  })).max(5),
});
export type AiInsight = z.infer<typeof aiInsightSchema>;

/** Extracts the first JSON object from a string — models sometimes wrap JSON in prose or code fences. */
export function extractJsonObject(text: string): unknown {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in AI response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
