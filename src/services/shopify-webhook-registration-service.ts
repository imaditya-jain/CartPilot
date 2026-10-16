import { createAdminClient, type AdminClient } from "@/lib/shopify/admin-client";
import { getServerEnv } from "@/lib/env";

const WEBHOOK_TOPICS = [
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_PAID",
  "ORDERS_CANCELLED",
  "APP_UNINSTALLED",
] as const;

const MUTATION = `
  mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription { id }
      userErrors { field message }
    }
  }
`;

interface MutationResult {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

/**
 * Registers webhook subscriptions for every topic our handler understands, pointing at this
 * app's single /api/shopify/webhooks endpoint (which dispatches by topic header). Idempotent:
 * re-running for an already-subscribed topic returns a "has already been taken" userError from
 * Shopify, which is treated as success rather than a failure.
 *
 * Never throws — a webhook registration failure shouldn't block the store connection itself.
 * Each topic's outcome is returned so the caller can log failures for visibility.
 */
export async function registerStoreWebhooks(
  shopDomain: string,
  accessToken: string
): Promise<{ topic: string; ok: boolean; error?: string }[]> {
  const env = getServerEnv();
  const callbackUrl = new URL("/api/shopify/webhooks", env.SHOPIFY_APP_URL).toString();
  const client: AdminClient = createAdminClient(shopDomain, accessToken);

  const results: { topic: string; ok: boolean; error?: string }[] = [];

  for (const topic of WEBHOOK_TOPICS) {
    try {
      const data = await client.request<MutationResult>(MUTATION, {
        topic,
        webhookSubscription: { callbackUrl, format: "JSON" },
      });

      const errors = data.webhookSubscriptionCreate.userErrors;
      const alreadyRegistered = errors.some((e) => /already been taken|already exists/i.test(e.message));

      if (errors.length === 0 || alreadyRegistered) {
        results.push({ topic, ok: true });
      } else {
        results.push({ topic, ok: false, error: errors.map((e) => e.message).join("; ") });
      }
    } catch (error) {
      results.push({ topic, ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return results;
}
