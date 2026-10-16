import { getServerEnv } from "@/lib/env";

export class ShopifyApiError extends Error {
  readonly status: number;
  readonly userErrors?: unknown;

  constructor(status: number, message: string, userErrors?: unknown) {
    super(message);
    this.status = status;
    this.userErrors = userErrors;
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: {
    cost?: {
      throttleStatus?: { currentlyAvailable: number; restoreRate: number };
    };
  };
}

const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A minimal Shopify Admin GraphQL client scoped to one store's credentials. Retries only on
 * throttling (cost-based rate limiting) — never on 4xx/validation errors — and never retries
 * indefinitely.
 */
export function createAdminClient(shopDomain: string, accessToken: string) {
  const env = getServerEnv();
  const endpoint = `https://${shopDomain}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`;

  async function request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
        await sleep(Math.min(retryAfter, 5) * 1000);
        continue;
      }

      if (!response.ok) {
        throw new ShopifyApiError(response.status, `Shopify API request failed (${response.status}).`);
      }

      const body = (await response.json()) as GraphQLResponse<T>;

      if (body.errors && body.errors.length > 0) {
        const throttled = body.errors.some((e) => e.message.toLowerCase().includes("throttled"));
        if (throttled && attempt < MAX_RETRIES) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw new ShopifyApiError(502, body.errors.map((e) => e.message).join("; "));
      }

      if (!body.data) {
        throw new ShopifyApiError(502, "Shopify API returned no data.");
      }

      return body.data;
    }

    throw new ShopifyApiError(429, "Shopify API rate limit exceeded after retries.");
  }

  return { request };
}

export type AdminClient = ReturnType<typeof createAdminClient>;
