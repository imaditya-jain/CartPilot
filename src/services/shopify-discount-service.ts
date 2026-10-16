import type { AdminClient } from "@/lib/shopify/admin-client";
import type { DiscountRuleDocument } from "@/models/DiscountRule";
import { ApiError } from "@/lib/utils/api-response";

const MUTATION = `
  mutation CreateDiscountCode($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode {
        id
        codeDiscount {
          ... on DiscountCodeBasic {
            codes(first: 1) { nodes { code } }
          }
        }
      }
      userErrors { field message code }
    }
  }
`;

interface MutationResult {
  discountCodeBasicCreate: {
    codeDiscountNode: {
      id: string;
      codeDiscount: { codes: { nodes: Array<{ code: string }> } };
    } | null;
    userErrors: Array<{ field: string[] | null; message: string; code: string }>;
  };
}

export interface CreateDiscountCodeResult {
  shopifyDiscountId: string;
  code: string;
}

function generateCode(ruleName: string): string {
  const slug = ruleName.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "OFFER";
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${slug}-${suffix}`;
}

/**
 * Creates a real, redeemable Shopify discount code for one eligible customer via the Admin
 * GraphQL API's DiscountCodeBasicInput mutation (verified against API version 2026-07, pinned in
 * src/lib/env.ts — re-check this input shape against Shopify's current schema if it starts
 * failing after an API version bump). The discount amount and type always come from the
 * merchant's own configured rule, never from the AI layer.
 */
export async function createDiscountCode(
  client: AdminClient,
  rule: Pick<DiscountRuleDocument, "name" | "discountType" | "discountValue" | "appliesOncePerCustomer">,
  shopifyCustomerId: string
): Promise<CreateDiscountCodeResult> {
  const code = generateCode(rule.name);

  const customerGetsValue =
    rule.discountType === "percentage"
      ? { percentage: rule.discountValue / 100 }
      : { discountAmount: { amount: rule.discountValue.toFixed(2), appliesOnEachItem: false } };

  const data = await client.request<MutationResult>(MUTATION, {
    basicCodeDiscount: {
      title: rule.name,
      code,
      startsAt: new Date().toISOString(),
      customerSelection: { customers: { add: [shopifyCustomerId] } },
      customerGets: { value: customerGetsValue, items: { all: true } },
      appliesOncePerCustomer: rule.appliesOncePerCustomer,
      usageLimit: 1,
    },
  });

  const { codeDiscountNode, userErrors } = data.discountCodeBasicCreate;
  if (userErrors.length > 0 || !codeDiscountNode) {
    const message = userErrors.map((e) => e.message).join("; ") || "Shopify did not return a discount code.";
    throw new ApiError(422, "SHOPIFY_DISCOUNT_FAILED", message);
  }

  const createdCode = codeDiscountNode.codeDiscount.codes.nodes[0]?.code ?? code;
  return { shopifyDiscountId: codeDiscountNode.id, code: createdCode };
}
