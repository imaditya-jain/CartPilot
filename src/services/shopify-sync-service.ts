import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Store, type StoreDocument } from "@/models/Store";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { createAdminClient, type AdminClient } from "@/lib/shopify/admin-client";
import { decryptSecret } from "@/lib/shopify/crypto";
import { requireOwnedStore } from "@/services/store-service";
import { scheduleStoreKnowledgeRebuild } from "@/services/chatbot-knowledge-service";

const PAGE_SIZE = 50;

export async function getDecryptedAccessToken(storeId: string): Promise<{ store: StoreDocument; accessToken: string }> {
  await connectToDatabase();
  const store = await Store.findById(storeId).select("+encryptedAccessToken");
  if (!store || !store.encryptedAccessToken) {
    throw new Error("Store is not connected.");
  }
  const accessToken = await decryptSecret(store.encryptedAccessToken);
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
    orders(first: ${PAGE_SIZE}, after: $cursor, sortKey: CREATED_AT) {
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
      pageInfo { hasNextPage }
    }
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
    pageInfo: { hasNextPage: boolean };
  };
}

export async function syncOrders(storeId: string, client: AdminClient, tenantId: string): Promise<number> {
  const storeObjectId = new Types.ObjectId(storeId);
  const tenantObjectId = new Types.ObjectId(tenantId);
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

    hasNextPage = data.orders.edges.length === PAGE_SIZE && data.orders.pageInfo.hasNextPage;
    cursor = data.orders.edges.at(-1)?.cursor ?? null;
  }

  return total;
}

/**
 * Full product + order sync for one store. Runs in-process (fire-and-forget from the API
 * route) rather than on a job queue — acceptable for an MVP on a single always-on Node
 * instance, but won't survive a serverless function being torn down mid-sync. Swap for a real
 * queue (BullMQ, etc.) before scaling to multiple instances or a serverless deployment.
 */
export async function runStoreSync(storeId: string, tenantId: string): Promise<void> {
  await connectToDatabase();
  await requireOwnedStore(storeId, tenantId);

  await Store.updateOne({ _id: storeId }, { $set: { syncStatus: "syncing", lastSyncError: null } });

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
      { $set: { syncStatus: "error", lastSyncError: message } }
    );
  }
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}
