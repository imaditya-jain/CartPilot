import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { requireOwnedStore } from "@/services/store-service";
import type { ChatProductReference } from "@/models/ChatConversation";

export interface CustomerPurchaseProfile {
  customerId: string;
  orderCount: number;
  totalSpent: number;
  purchasedProductIds: string[];
  purchasedProductTypes: string[];
}

export interface CandidateProduct {
  shopifyProductId: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
  url: string;
  productType: string;
}

/** Builds a purchased-product and spend profile for one customer — the shared input to both the
 *  upsell/bundle recommenders below and the discount-eligibility check in
 *  discount-eligibility-service.ts. */
export async function getCustomerPurchaseProfile(
  storeId: string,
  tenantId: string,
  customerId: string
): Promise<CustomerPurchaseProfile> {
  await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();

  const storeObjectId = new Types.ObjectId(storeId);
  const orders = await Order.find({ storeId: storeObjectId, customerId, cancelledAt: null })
    .select("totalPrice lineItems")
    .lean();

  const purchasedProductIds = Array.from(
    new Set(
      orders.flatMap((order) =>
        order.lineItems.map((item) => item.shopifyProductId).filter((id): id is string => id !== null)
      )
    )
  );
  const totalSpent = orders.reduce((sum, order) => sum + order.totalPrice, 0);

  const purchasedProducts = purchasedProductIds.length
    ? await Product.find({ storeId: storeObjectId, shopifyProductId: { $in: purchasedProductIds } })
        .select("productType variants")
        .lean()
    : [];
  const purchasedProductTypes = Array.from(
    new Set(purchasedProducts.map((p) => p.productType).filter((type): type is string => Boolean(type)))
  );

  return { customerId, orderCount: orders.length, totalSpent, purchasedProductIds, purchasedProductTypes };
}

/** Distinct tags across a set of products — used to check "suggested product has tag X" rules. */
export async function getProductTags(storeId: string, shopifyProductIds: string[]): Promise<string[]> {
  if (shopifyProductIds.length === 0) return [];
  await connectToDatabase();
  const storeObjectId = new Types.ObjectId(storeId);

  const products = await Product.find({ storeId: storeObjectId, shopifyProductId: { $in: shopifyProductIds } })
    .select("tags")
    .lean();
  return Array.from(new Set(products.flatMap((p) => p.tags)));
}

/** Pure: the average price paid, per product type, across a set of already-purchased items. */
export function averagePriceByProductType(items: Array<{ productType: string; price: number | null }>): Record<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const item of items) {
    if (item.price === null || !item.productType) continue;
    const entry = sums.get(item.productType) ?? { total: 0, count: 0 };
    entry.total += item.price;
    entry.count += 1;
    sums.set(item.productType, entry);
  }
  const result: Record<string, number> = {};
  for (const [type, { total, count }] of sums) {
    result[type] = total / count;
  }
  return result;
}

/**
 * Pure: filters and ranks upsell candidates — products the customer hasn't bought, in a category
 * they've already shown interest in, priced at or above what they've paid in that category before.
 * Kept separate from the DB-fetching wrapper below so this logic is unit-testable without Mongo.
 */
export function rankUpsellCandidates(
  candidates: CandidateProduct[],
  purchasedProductIds: string[],
  purchasedProductTypes: string[],
  averagePriceByType: Record<string, number>,
  limit = 3
): CandidateProduct[] {
  return candidates
    .filter((p) => !purchasedProductIds.includes(p.shopifyProductId))
    .filter((p) => purchasedProductTypes.includes(p.productType))
    .filter((p) => p.price !== null && p.price >= (averagePriceByType[p.productType] ?? 0))
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    .slice(0, limit);
}

export async function getUpsellProducts(
  storeId: string,
  shopDomain: string,
  profile: CustomerPurchaseProfile,
  limit = 3
): Promise<ChatProductReference[]> {
  if (profile.purchasedProductTypes.length === 0) return [];
  await connectToDatabase();
  const storeObjectId = new Types.ObjectId(storeId);

  const [purchasedProducts, candidateProducts] = await Promise.all([
    Product.find({ storeId: storeObjectId, shopifyProductId: { $in: profile.purchasedProductIds } })
      .select("productType variants")
      .lean(),
    Product.find({
      storeId: storeObjectId,
      productType: { $in: profile.purchasedProductTypes },
      status: "active",
    })
      .select("shopifyProductId title handle productType imageUrls variants")
      .lean(),
  ]);

  const averagePrices = averagePriceByProductType(
    purchasedProducts.map((p) => ({ productType: p.productType, price: p.variants[0]?.price ?? null }))
  );

  const candidates: CandidateProduct[] = candidateProducts.map((p) => ({
    shopifyProductId: p.shopifyProductId,
    title: p.title,
    price: p.variants[0]?.price ?? null,
    imageUrl: p.imageUrls[0] ?? null,
    url: `https://${shopDomain}/products/${p.handle}`,
    productType: p.productType,
  }));

  const ranked = rankUpsellCandidates(
    candidates,
    profile.purchasedProductIds,
    profile.purchasedProductTypes,
    averagePrices,
    limit
  );

  return ranked.map((c) => ({ shopifyProductId: c.shopifyProductId, title: c.title, price: c.price, imageUrl: c.imageUrl, url: c.url }));
}

/**
 * "Frequently bought together": products that co-occur, store-wide, in the same order as
 * something this customer has already purchased — excluding anything they've already bought.
 */
export async function getBundleProducts(
  storeId: string,
  shopDomain: string,
  profile: CustomerPurchaseProfile,
  limit = 3
): Promise<ChatProductReference[]> {
  if (profile.purchasedProductIds.length === 0) return [];
  await connectToDatabase();
  const storeObjectId = new Types.ObjectId(storeId);

  const coOccurrence: Array<{ _id: string; occurrences: number }> = await Order.aggregate([
    {
      $match: {
        storeId: storeObjectId,
        cancelledAt: null,
        "lineItems.shopifyProductId": { $in: profile.purchasedProductIds },
      },
    },
    { $unwind: "$lineItems" },
    {
      $match: {
        "lineItems.shopifyProductId": { $nin: [...profile.purchasedProductIds, null] },
      },
    },
    { $group: { _id: "$lineItems.shopifyProductId", occurrences: { $sum: 1 } } },
    { $sort: { occurrences: -1 } },
    { $limit: limit },
  ]);

  if (coOccurrence.length === 0) return [];

  const productIds = coOccurrence.map((row) => row._id);
  const products = await Product.find({ storeId: storeObjectId, shopifyProductId: { $in: productIds }, status: "active" })
    .select("shopifyProductId title handle imageUrls variants")
    .lean();
  const byId = new Map(products.map((p) => [p.shopifyProductId, p]));

  return coOccurrence
    .map((row) => byId.get(row._id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      shopifyProductId: p.shopifyProductId,
      title: p.title,
      price: p.variants[0]?.price ?? null,
      imageUrl: p.imageUrls[0] ?? null,
      url: `https://${shopDomain}/products/${p.handle}`,
    }));
}
