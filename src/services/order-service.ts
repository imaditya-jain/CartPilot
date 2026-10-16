import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { requireOwnedStore } from "@/services/store-service";
import { ApiError } from "@/lib/utils/api-response";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listOrdersForStore(
  storeId: string,
  tenantId: string,
  page: number,
  pageSize: number
) {
  await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();

  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const safePage = Math.max(page, 1);

  const [items, total] = await Promise.all([
    Order.find({ storeId })
      .sort({ shopifyCreatedAt: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .select("name financialStatus fulfillmentStatus currency totalPrice shopifyCreatedAt cancelledAt")
      .lean(),
    Order.countDocuments({ storeId }),
  ]);

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(Math.ceil(total / safePageSize), 1),
  };
}

/** tenantId is denormalized onto every Order document at sync time — same isolation chokepoint as getProductById. */
export async function getOrderById(orderId: string, tenantId: string) {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  await connectToDatabase();

  const order = await Order.findOne({ _id: orderId, tenantId }).lean();
  if (!order) {
    throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  }

  const productIds = order.lineItems.map((li) => li.shopifyProductId).filter((id): id is string => !!id);
  const products =
    productIds.length > 0
      ? await Product.find({ storeId: order.storeId, shopifyProductId: { $in: productIds } })
          .select("shopifyProductId imageUrls handle")
          .lean()
      : [];
  const productByShopifyId = new Map(products.map((p) => [p.shopifyProductId, p]));

  return {
    order,
    lineItemsEnriched: order.lineItems.map((li) => ({
      ...li,
      imageUrl: li.shopifyProductId ? productByShopifyId.get(li.shopifyProductId)?.imageUrls[0] ?? null : null,
      productHandle: li.shopifyProductId ? productByShopifyId.get(li.shopifyProductId)?.handle ?? null : null,
    })),
  };
}
