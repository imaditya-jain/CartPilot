import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Store, type StoreDocument } from "@/models/Store";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { createAdminClient, type AdminClient } from "@/lib/shopify/admin-client";
import { decryptSecret, encryptSecret } from "@/lib/shopify/crypto";
import { requireOwnedStore } from "@/services/store-service";
import { scheduleStoreKnowledgeRebuild } from "@/services/chatbot-knowledge-service";
import { migrateLegacyOfflineToken, refreshShopifyOfflineToken } from "@/services/shopify-token-service";
import type { ShopifyOfflineToken } from "@/services/shopify-oauth-service";
import { ApiError } from "@/lib/utils/api-response";

const PAGE_SIZE = 50;
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;
const pendingTokenRefreshes = new Map<string, Promise<string>>();

async function refreshOrMigrateStoreToken(storeId: string, shopDomain: string, accessToken: string): Promise<string> {
  const pending = pendingTokenRefreshes.get(storeId);
  if (pending) return pending;

  const refresh = (async () => {
    const store = await Store.findById(storeId).select("+encryptedAccessToken +encryptedRefreshToken");
    if (!store?.encryptedAccessToken) throw new Error("Store is not connected.");

    // Another request may have refreshed the token while this request was waiting for the lock.
    if (
      store.encryptedRefreshToken &&
      store.accessTokenExpiresAt &&
      store.accessTokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_BUFFER_MS
    ) {
      return decryptSecret(store.encryptedAccessToken);
    }

    let tokenPair: ShopifyOfflineToken;
    if (store.encryptedRefreshToken) {
      if (store.refreshTokenExpiresAt && store.refreshTokenExpiresAt.getTime() <= Date.now()) {
        throw new Error("Shopify refresh token expired. Reconnect this store to restore access.");
      }
      const refreshToken = await decryptSecret(store.encryptedRefreshToken);
      tokenPair = await refreshShopifyOfflineToken(shopDomain, refreshToken);
    } else if (store.tokenType === "custom") {
      return accessToken;
    } else {
      // Existing installations may still have a permanent offline token. Shopify provides a
      // token-exchange migration that converts it without requiring the merchant to reinstall.
      tokenPair = await migrateLegacyOfflineToken(shopDomain, await decryptSecret(store.encryptedAccessToken));
    }

    const [encryptedAccessToken, encryptedRefreshToken] = await Promise.all([
      encryptSecret(tokenPair.accessToken),
      encryptSecret(tokenPair.refreshToken),
    ]);
    await Store.updateOne(
      { _id: storeId },
      {
        $set: {
          encryptedAccessToken,
          encryptedRefreshToken,
          accessTokenExpiresAt: tokenPair.accessTokenExpiresAt,
          refreshTokenExpiresAt: tokenPair.refreshTokenExpiresAt,
          tokenType: "oauth_offline",
        },
      }
    );
    return tokenPair.accessToken;
  })();

  pendingTokenRefreshes.set(storeId, refresh);
  try {
    return await refresh;
  } catch (error) {
    // A different serverless instance may have won the refresh-token rotation race and saved
    // the replacement pair while this request's refresh was rejected. Reuse that fresh token.
    const latestStore = await Store.findById(storeId)
      .select("+encryptedAccessToken +encryptedRefreshToken")
      .catch(() => null);
    if (
      latestStore?.encryptedAccessToken &&
      latestStore.encryptedRefreshToken &&
      latestStore.accessTokenExpiresAt &&
      latestStore.accessTokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_BUFFER_MS
    ) {
      return decryptSecret(latestStore.encryptedAccessToken);
    }

    const message = error instanceof Error ? error.message : "Unknown Shopify token refresh error.";
    throw new Error(`Could not refresh Shopify access for ${shopDomain}: ${message} Reconnect the store if the problem continues.`);
  } finally {
    pendingTokenRefreshes.delete(storeId);
  }
}

export async function getDecryptedAccessToken(storeId: string): Promise<{ store: StoreDocument; accessToken: string }> {
  await connectToDatabase();
  const store = await Store.findById(storeId).select("+encryptedAccessToken +encryptedRefreshToken");
  if (!store || !store.encryptedAccessToken) {
    throw new Error("Store is not connected.");
  }
  let accessToken = await decryptSecret(store.encryptedAccessToken);

  if (store.tokenType !== "custom") {
    const accessTokenExpiresAt = store.accessTokenExpiresAt?.getTime() ?? 0;
    const hasRefreshToken = Boolean(store.encryptedRefreshToken);
    if (!hasRefreshToken || accessTokenExpiresAt <= Date.now() + TOKEN_REFRESH_BUFFER_MS) {
      accessToken = await refreshOrMigrateStoreToken(storeId, store.shopDomain, accessToken);
    }
  }

  return { store, accessToken };
}

const PRODUCTS_QUERY = `
  query ProductsSync($cursor: String) {
    products(first: ${PAGE_SIZE}, after: $cursor) {
      edges {
        cursor
        node {
          id
          title
          handle
          descriptionHtml
          status
          vendor
          productType
          tags
          updatedAt
          featuredImage { url }
          images(first: 5) { edges { node { url } } }
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
              }
            }
          }
        }
      }
      pageInfo { hasNextPage }
    }
  }
`;

interface ProductsQueryResult {
  products: {
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        title: string;
        handle: string;
        descriptionHtml: string;
        status: string;
        vendor: string;
        productType: string;
        tags: string[];
        updatedAt: string;
        featuredImage: { url: string } | null;
        images: { edges: Array<{ node: { url: string } }> };
        variants: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              sku: string | null;
              price: string;
              compareAtPrice: string | null;
              inventoryQuantity: number | null;
            };
          }>;
        };
      };
    }>;
    pageInfo: { hasNextPage: boolean };
  };
}

export async function syncProducts(storeId: string, client: AdminClient, tenantId: string): Promise<number> {
  const storeObjectId = new Types.ObjectId(storeId);
  const tenantObjectId = new Types.ObjectId(tenantId);
  let cursor: string | null = null;
  let hasNextPage = true;
  let total = 0;

  while (hasNextPage) {
    const data: ProductsQueryResult = await client.request(PRODUCTS_QUERY, { cursor });

    const ops = data.products.edges.map(({ node }) => {
      const imageUrls = [
        ...(node.featuredImage ? [node.featuredImage.url] : []),
        ...node.images.edges.map((e) => e.node.url),
      ];
      const uniqueImageUrls = Array.from(new Set(imageUrls));

      return {
        updateOne: {
          filter: { storeId: storeObjectId, shopifyProductId: node.id },
          update: {
            $set: {
              tenantId: tenantObjectId,
              storeId: storeObjectId,
              shopifyProductId: node.id,
              title: node.title,
              handle: node.handle,
              description: node.descriptionHtml ?? "",
              status: node.status,
              vendor: node.vendor,
              productType: node.productType,
              tags: node.tags,
              imageUrls: uniqueImageUrls,
              variants: node.variants.edges.map((e) => ({
                shopifyVariantId: e.node.id,
                title: e.node.title,
                sku: e.node.sku,
                price: Number.parseFloat(e.node.price),
                compareAtPrice: e.node.compareAtPrice ? Number.parseFloat(e.node.compareAtPrice) : null,
                inventoryQuantity: e.node.inventoryQuantity,
              })),
              shopifyUpdatedAt: new Date(node.updatedAt),
              syncedAt: new Date(),
            },
          },
          upsert: true,
        },
      };
    });

    if (ops.length > 0) {
      await Product.bulkWrite(ops, { ordered: false });
      total += ops.length;
    }

    hasNextPage = data.products.edges.length === PAGE_SIZE && data.products.pageInfo.hasNextPage;
    cursor = data.products.edges.at(-1)?.cursor ?? null;
  }

  return total;
}

const ORDERS_QUERY = `
  query OrdersSync($cursor: String) {
    orders(first: ${PAGE_SIZE}, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      edges {
        cursor
        node {
          id
          name
          displayFinancialStatus
          displayFulfillmentStatus
          cancelledAt
          currencyCode
          customer { id email displayName }
          subtotalPriceSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          createdAt
          updatedAt
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
                originalUnitPriceSet { shopMoney { amount } }
                product { id }
                variant { id }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const ORDERS_COUNT_QUERY = `
  query OrdersCount {
    ordersCount(limit: 10000) { count }
  }
`;

interface OrdersQueryResult {
  orders: {
    edges: Array<{
      cursor: string;
      node: {
        id: string;
        name: string;
        displayFinancialStatus: string | null;
        displayFulfillmentStatus: string | null;
        cancelledAt: string | null;
        currencyCode: string;
        customer: { id: string; email: string | null; displayName: string } | null;
        subtotalPriceSet: { shopMoney: { amount: string } };
        totalDiscountsSet: { shopMoney: { amount: string } };
        totalPriceSet: { shopMoney: { amount: string } };
        createdAt: string;
        updatedAt: string;
        lineItems: {
          edges: Array<{
            node: {
              title: string;
              quantity: number;
              originalUnitPriceSet: { shopMoney: { amount: string } };
              product: { id: string } | null;
              variant: { id: string } | null;
            };
          }>;
        };
      };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface OrdersCountQueryResult {
  ordersCount: { count: number };
}

export async function syncOrders(storeId: string, client: AdminClient, tenantId: string): Promise<number> {
  const storeObjectId = new Types.ObjectId(storeId);
  const tenantObjectId = new Types.ObjectId(tenantId);
  const { ordersCount } = await client.request<OrdersCountQueryResult>(ORDERS_COUNT_QUERY);
  let cursor: string | null = null;
  let hasNextPage = true;
  let total = 0;

  while (hasNextPage) {
    const data: OrdersQueryResult = await client.request(ORDERS_QUERY, { cursor });

    const ops = data.orders.edges.map(({ node }) => ({
      updateOne: {
        filter: { storeId: storeObjectId, shopifyOrderId: node.id },
        update: {
          $set: {
            tenantId: tenantObjectId,
            storeId: storeObjectId,
            shopifyOrderId: node.id,
            name: node.name,
            financialStatus: node.displayFinancialStatus,
            fulfillmentStatus: node.displayFulfillmentStatus,
            cancelledAt: node.cancelledAt ? new Date(node.cancelledAt) : null,
            customerId: node.customer?.id ?? null,
            customerEmail: node.customer?.email ?? null,
            customerName: node.customer?.displayName ?? null,
            currency: node.currencyCode,
            subtotalPrice: Number.parseFloat(node.subtotalPriceSet.shopMoney.amount),
            totalDiscounts: Number.parseFloat(node.totalDiscountsSet.shopMoney.amount),
            totalPrice: Number.parseFloat(node.totalPriceSet.shopMoney.amount),
            lineItems: node.lineItems.edges.map((e) => ({
              shopifyProductId: e.node.product?.id ?? null,
              shopifyVariantId: e.node.variant?.id ?? null,
              title: e.node.title,
              quantity: e.node.quantity,
              price: Number.parseFloat(e.node.originalUnitPriceSet.shopMoney.amount),
            })),
            shopifyCreatedAt: new Date(node.createdAt),
            shopifyUpdatedAt: new Date(node.updatedAt),
            syncedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await Order.bulkWrite(ops, { ordered: false });
      total += ops.length;
    }

    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
    if (hasNextPage && !cursor) {
      throw new Error("Shopify indicated more orders are available but did not return a pagination cursor.");
    }
  }

  if (ordersCount.count > 0 && total === 0) {
    throw new ApiError(
      502,
      "SHOPIFY_ORDERS_NOT_ACCESSIBLE",
      `Shopify reports ${ordersCount.count} orders, but returned none to sync. Confirm the app has read_orders access. Shopify only exposes the last 60 days by default; older orders require Shopify approval for read_all_orders, followed by updating the app scopes and reconnecting the store.`
    );
  }

  return total;
}

/** Full product + order sync for one store. Route handlers await this work on serverless. */
export async function runStoreSync(storeId: string, tenantId: string): Promise<void> {
  await connectToDatabase();
  await requireOwnedStore(storeId, tenantId);

  await Store.updateOne(
    { _id: storeId },
    { $set: { syncStatus: "syncing", syncStartedAt: new Date(), lastSyncError: null } }
  );

  try {
    const { store, accessToken } = await getDecryptedAccessToken(storeId);
    const client = createAdminClient(store.shopDomain, accessToken);

    const [productCount, orderCount] = await Promise.all([
      syncProducts(storeId, client, tenantId),
      syncOrders(storeId, client, tenantId),
    ]);

    await Store.updateOne(
      { _id: storeId },
      {
        $set: {
          syncStatus: "idle",
          syncStartedAt: null,
          lastSyncedAt: new Date(),
          lastSyncError: null,
          productCount,
          orderCount,
        },
      }
    );
    scheduleStoreKnowledgeRebuild(storeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error.";
    console.error(`Sync failed for store ${storeId}:`, error);
    await Store.updateOne(
      { _id: storeId },
      { $set: { syncStatus: "error", syncStartedAt: null, lastSyncError: message } }
    );
    throw error instanceof ApiError
      ? error
      : new ApiError(502, "SHOPIFY_SYNC_FAILED", message);
  }
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
