import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { requireOwnedStore } from "@/services/store-service";
import { ApiError } from "@/lib/utils/api-response";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listProductsForStore(
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
    Product.find({ storeId })
      .sort({ shopifyUpdatedAt: -1 })
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .select("title handle status vendor imageUrls variants shopifyUpdatedAt")
      .lean(),
    Product.countDocuments({ storeId }),
  ]);

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(Math.ceil(total / safePageSize), 1),
  };
}

/**
 * tenantId is denormalized onto every Product document at sync time (see
 * shopify-sync-service.ts), so a single query enforces tenant isolation here without a separate
 * store-ownership lookup — this is the same reason a cross-tenant document ID can never be
 * fetched by guessing it: the filter requires a tenantId match, not just the Mongo _id.
 */
export async function getProductById(productId: string, tenantId: string) {
  if (!Types.ObjectId.isValid(productId)) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  await connectToDatabase();

  const product = await Product.findOne({ _id: productId, tenantId }).lean();
  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }
  return product;
}
