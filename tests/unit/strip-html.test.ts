import { describe, expect, it } from "vitest";
import { stripHtml } from "@/lib/utils/strip-html";

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("strips a script tag AND its content, not just the tag markers", () => {
    const result = stripHtml('<script>alert("xss")</script><p>Safe text</p>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toBe("Safe text");
  });

  it("decodes common HTML entities", () => {
    expect(stripHtml("Tom &amp; Jerry&#39;s &quot;Shop&quot;")).toBe(`Tom & Jerry's "Shop"`);
  });

  it("handles plain text with no tags", () => {
    expect(stripHtml("Just plain text.")).toBe("Just plain text.");
  });
});
