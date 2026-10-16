import { describe, expect, it } from "vitest";
import { generateTemplatedReply } from "@/services/chatbot-message-service";

describe("generateTemplatedReply", () => {
  it("returns a found-phrase per tone when matches exist", () => {
    expect(generateTemplatedReply("friendly", 2)).toMatch(/found/i);
    expect(generateTemplatedReply("concise", 1)).not.toMatch(/couldn't|no matches/i);
  });

  it("returns an empty-phrase per tone when there are no matches", () => {
    expect(generateTemplatedReply("friendly", 0)).toMatch(/couldn't find/i);
    expect(generateTemplatedReply("concise", 0)).toMatch(/no matches/i);
  });

  it("falls back to the friendly phrasing for an unrecognized tone", () => {
    // @ts-expect-error — intentionally passing an invalid tone to verify the fallback branch
    expect(generateTemplatedReply("unknown-tone", 1)).toBe(generateTemplatedReply("friendly", 1));
  });
});
