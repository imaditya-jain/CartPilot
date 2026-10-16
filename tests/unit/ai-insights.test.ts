import { describe, expect, it } from "vitest";
import { extractJsonObject, aiInsightSchema } from "@/lib/validation/ai-insights";

describe("extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it("extracts JSON from a fenced code block", () => {
    const text = 'Here is the result:\n```json\n{"a": 1, "b": "two"}\n```\nHope that helps!';
    expect(extractJsonObject(text)).toEqual({ a: 1, b: "two" });
  });

  it("extracts a JSON object embedded in surrounding prose without fences", () => {
    const text = 'Sure, here you go: {"summary": "ok"} let me know if you need more.';
    expect(extractJsonObject(text)).toEqual({ summary: "ok" });
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJsonObject("no json here at all")).toThrow();
  });
});

describe("aiInsightSchema", () => {
  it("accepts a well-formed insight", () => {
    const result = aiInsightSchema.parse({
      summary: "Sales are steady.",
      observations: ["Orders are up 10%."],
      suggestedActions: ["Promote your top product."],
    });
    expect(result.observations).toHaveLength(1);
  });

  it("rejects a response missing required fields", () => {
    expect(() => aiInsightSchema.parse({ summary: "Only a summary" })).toThrow();
  });

  it("rejects non-array observations (a common model-output shape mistake)", () => {
    expect(() =>
      aiInsightSchema.parse({ summary: "ok", observations: "not an array", suggestedActions: ["x"] })
    ).toThrow();
  });
});
