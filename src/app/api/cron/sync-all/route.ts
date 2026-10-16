import { NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { listAllConnectedStores } from "@/services/store-service";
import { runStoreSync } from "@/services/shopify-sync-service";
import { ok, fail } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest, secret: string): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

/**
 * Daily reconciliation sync for every connected store, on top of (not instead of) the real-time
 * webhooks already registered on connect — webhooks keep products/orders current as changes
 * happen, this is the safety net in case a webhook delivery is ever missed. Not reachable at all
 * unless CRON_SECRET is set; accepts either `Authorization: Bearer <secret>` (Vercel Cron's
 * convention) or `x-cron-secret: <secret>` so it works with any external scheduler. See
 * "Automatic daily sync" in README for how to wire this up to an actual schedule.
 */
export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (!env.CRON_SECRET) {
    return fail(503, "CRON_NOT_CONFIGURED", "Set CRON_SECRET to enable the daily reconciliation sync.");
  }
  if (!isAuthorized(request, env.CRON_SECRET)) {
    return fail(401, "UNAUTHORIZED", "Invalid or missing cron credentials.");
  }

  const stores = await listAllConnectedStores();
  const results: Array<{ storeId: string; shopDomain: string; ok: boolean; error?: string }> = [];

  for (const store of stores) {
    try {
      await runStoreSync(store._id.toString(), store.tenantId.toString());
      results.push({ storeId: store._id.toString(), shopDomain: store.shopDomain, ok: true });
    } catch (error) {
      results.push({
        storeId: store._id.toString(),
        shopDomain: store.shopDomain,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return ok({ syncedStores: results.length, results });
}

export const POST = GET;
