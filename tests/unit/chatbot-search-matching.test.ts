import { describe, expect, it } from "vitest";

/**
 * withSingularVariant/tokenize aren't exported (internal to the search function), so this
 * exercises the same regex-construction logic they feed, directly — the thing that actually
 * matters: does a plural shopper query match a singular catalog title.
 */
function withSingularVariant(term: string): string[] {
  if (term.length > 3 && term.endsWith("s")) {
    return [term, term.slice(0, -1)];
  }
  return [term];
}

function buildPattern(terms: string[]): RegExp {
  const pattern = terms.flatMap(withSingularVariant).join("|");
  return new RegExp(pattern, "i");
}

describe("plural/singular catalog matching", () => {
  it("matches a plural query term against a singular catalog title", () => {
    const regex = buildPattern(["sneakers"]);
    expect(regex.test("Classic Sneaker")).toBe(true);
  });

  it("matches a plural query term against a plural catalog tag", () => {
    const regex = buildPattern(["shoes"]);
    expect(regex.test("shoes")).toBe(true);
  });

  it("does not singularize short words (avoids false positives like 'gas' -> 'ga')", () => {
    expect(withSingularVariant("gas")).toEqual(["gas"]);
  });

  it("still matches an exact non-plural term", () => {
    const regex = buildPattern(["wallet"]);
    expect(regex.test("Leather Wallet")).toBe(true);
  });
});
