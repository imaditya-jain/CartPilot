import { connectToDatabase } from "@/lib/mongodb";
import { Store, type StoreDocument } from "@/models/Store";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";

const toProductGid = (id: number | string) => `gid://shopify/Product/${id}`;
const toVariantGid = (id: number | string) => `gid://shopify/ProductVariant/${id}`;
const toOrderGid = (id: number | string) => `gid://shopify/Order/${id}`;
const toCustomerGid = (id: number | string) => `gid://shopify/Customer/${id}`;

interface RestVariant {
  id: number;
  title: string;
  sku: string | null;
  price: string;
  compare_at_price: string | null;
  inventory_quantity: number | null;
}

interface RestProductPayload {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  status: string;
  vendor: string;
  product_type: string;
  tags: string;
  updated_at: string;
  images: Array<{ src: string }>;
  variants: RestVariant[];
}

export async function handleProductWebhook(store: StoreDocument, payload: RestProductPayload): Promise<void> {
  await connectToDatabase();
  await Product.updateOne(
    { storeId: store._id, shopifyProductId: toProductGid(payload.id) },
    {
      $set: {
        tenantId: store.tenantId,
        storeId: store._id,
        shopifyProductId: toProductGid(payload.id),
        title: payload.title,
        handle: payload.handle,
        description: payload.body_html ?? "",
        status: payload.status,
        vendor: payload.vendor,
        productType: payload.product_type,
        tags: payload.tags ? payload.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        imageUrls: payload.images.map((img) => img.src),
        variants: payload.variants.map((v) => ({
          shopifyVariantId: toVariantGid(v.id),
          title: v.title,
          sku: v.sku,
          price: Number.parseFloat(v.price),
          compareAtPrice: v.compare_at_price ? Number.parseFloat(v.compare_at_price) : null,
          inventoryQuantity: v.inventory_quantity,
        })),
        shopifyUpdatedAt: new Date(payload.updated_at),
        syncedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function handleProductDeleteWebhook(store: StoreDocument, payload: { id: number }): Promise<void> {
  await connectToDatabase();
  await Product.deleteOne({ storeId: store._id, shopifyProductId: toProductGid(payload.id) });
}

interface RestLineItem {
  product_id: number | null;
  variant_id: number | null;
  title: string;
  quantity: number;
  price: string;
}

interface RestOrderPayload {
  id: number;
  name: string;
  financial_status: string | null;
  fulfillment_status: string | null;
  cancelled_at: string | null;
  customer: { id: number; email: string | null; first_name: string | null; last_name: string | null } | null;
  currency: string;
  subtotal_price: string;
  total_discounts: string;
  total_price: string;
  line_items: RestLineItem[];
  created_at: string;
  updated_at: string;
}

export async function handleOrderWebhook(store: StoreDocument, payload: RestOrderPayload): Promise<void> {
  await connectToDatabase();
  await Order.updateOne(
    { storeId: store._id, shopifyOrderId: toOrderGid(payload.id) },
    {
      $set: {
        tenantId: store.tenantId,
        storeId: store._id,
        shopifyOrderId: toOrderGid(payload.id),
        name: payload.name,
        financialStatus: payload.financial_status,
        fulfillmentStatus: payload.fulfillment_status,
        cancelledAt: payload.cancelled_at ? new Date(payload.cancelled_at) : null,
        customerId: payload.customer ? toCustomerGid(payload.customer.id) : null,
        customerEmail: payload.customer?.email ?? null,
        customerName: payload.customer
          ? [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(" ") || null
          : null,
        currency: payload.currency,
        subtotalPrice: Number.parseFloat(payload.subtotal_price),
        totalDiscounts: Number.parseFloat(payload.total_discounts),
        totalPrice: Number.parseFloat(payload.total_price),
        lineItems: payload.line_items.map((li) => ({
          shopifyProductId: li.product_id ? toProductGid(li.product_id) : null,
          shopifyVariantId: li.variant_id ? toVariantGid(li.variant_id) : null,
          title: li.title,
          quantity: li.quantity,
          price: Number.parseFloat(li.price),
        })),
        shopifyCreatedAt: new Date(payload.created_at),
        shopifyUpdatedAt: new Date(payload.updated_at),
        syncedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function handleAppUninstalledWebhook(shopDomain: string): Promise<void> {
  await connectToDatabase();
  await Store.updateMany(
    { shopDomain },
    {
      $set: {
        connectionStatus: "disconnected",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
      },
    }
  );
}
