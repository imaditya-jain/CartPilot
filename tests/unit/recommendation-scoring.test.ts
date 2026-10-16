import { describe, expect, it } from "vitest";
import {
  averagePriceByProductType,
  rankUpsellCandidates,
  type CandidateProduct,
} from "@/services/recommendation-service";

function candidate(overrides: Partial<CandidateProduct> = {}): CandidateProduct {
  return {
    shopifyProductId: "gid://shopify/Product/1",
    title: "Product",
    price: 50,
    imageUrl: null,
    url: "https://example.myshopify.com/products/product",
    productType: "Shoes",
    ...overrides,
  };
}

describe("averagePriceByProductType", () => {
  it("averages price per product type, ignoring null prices and blank types", () => {
    const result = averagePriceByProductType([
      { productType: "Shoes", price: 50 },
      { productType: "Shoes", price: 70 },
      { productType: "Hats", price: 20 },
      { productType: "Shoes", price: null },
      { productType: "", price: 10 },
    ]);
    expect(result).toEqual({ Shoes: 60, Hats: 20 });
  });

  it("returns an empty object for no items", () => {
    expect(averagePriceByProductType([])).toEqual({});
  });
});

describe("rankUpsellCandidates", () => {
  it("excludes already-purchased products", () => {
    const candidates = [candidate({ shopifyProductId: "p1" }), candidate({ shopifyProductId: "p2" })];
    const result = rankUpsellCandidates(candidates, ["p1"], ["Shoes"], {}, 3);
    expect(result.map((c) => c.shopifyProductId)).toEqual(["p2"]);
  });

  it("excludes products outside a category the customer has bought into", () => {
    const candidates = [candidate({ shopifyProductId: "p1", productType: "Hats" })];
    const result = rankUpsellCandidates(candidates, [], ["Shoes"], {}, 3);
    expect(result).toHaveLength(0);
  });

  it("excludes candidates priced below the category average", () => {
    const candidates = [candidate({ shopifyProductId: "p1", price: 30 })];
    const result = rankUpsellCandidates(candidates, [], ["Shoes"], { Shoes: 50 }, 3);
    expect(result).toHaveLength(0);
  });

  it("sorts remaining candidates by price descending and respects the limit", () => {
    const candidates = [
      candidate({ shopifyProductId: "p1", price: 60 }),
      candidate({ shopifyProductId: "p2", price: 90 }),
      candidate({ shopifyProductId: "p3", price: 75 }),
    ];
    const result = rankUpsellCandidates(candidates, [], ["Shoes"], { Shoes: 50 }, 2);
    expect(result.map((c) => c.shopifyProductId)).toEqual(["p2", "p3"]);
  });
});
