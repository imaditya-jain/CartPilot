import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { requireOwnedStore } from "@/services/store-service";

export interface DailyTrendPoint {
  day: string;
  orders: number;
  grossSales: number;
  totalDiscounts: number;
  averageOrderValue: number;
}

export interface StoreOverview {
  currency: string;
  totalOrders: number;
  grossSales: number;
  totalDiscounts: number;
  averageOrderValue: number;
  ordersByFinancialStatus: Array<{ status: string; count: number }>;
  paymentStatusSummary: { paid: number; unpaid: number; other: number };
  productsByStatus: Array<{ status: string; count: number }>;
  topProductsByRevenue: Array<{
    shopifyProductId: string | null;
    title: string;
    quantitySold: number;
    revenue: number;
  }>;
  bestSellingProducts: Array<{
    shopifyProductId: string;
    title: string;
    quantitySold: number;
    revenue: number;
    inventoryUnits: number | null;
    lowStockVariants: number;
  }>;
  slowestSellingProducts: Array<{
    shopifyProductId: string;
    title: string;
    quantitySold: number;
    revenue: number;
    inventoryUnits: number | null;
  }>;
  inventorySummary: {
    trackedVariants: number;
    lowStockVariants: number;
    outOfStockVariants: number;
    untrackedVariants: number;
    lowStockProducts: Array<{ shopifyProductId: string; title: string; variant: string; quantity: number }>;
    outOfStockProducts: Array<{ shopifyProductId: string; title: string; variant: string }>;
  };
  dailyTrend: DailyTrendPoint[];
}

const TREND_DAYS = 14;

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Fills in any day with no orders as zeroes, so the frontend never has to handle gaps. */
function zeroFillTrend(rows: Array<{ _id: string; orders: number; grossSales: number; totalDiscounts: number; averageOrderValue: number }>): DailyTrendPoint[] {
  const byDay = new Map(rows.map((row) => [row._id, row]));
  const points: DailyTrendPoint[] = [];

  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - i);
    const day = formatDay(date);
    const row = byDay.get(day);
    points.push({
      day,
      orders: row?.orders ?? 0,
      grossSales: row?.grossSales ?? 0,
      totalDiscounts: row?.totalDiscounts ?? 0,
      averageOrderValue: row?.averageOrderValue ?? 0,
    });
  }

  return points;
}

/**
 * All figures here come straight from MongoDB aggregation over the synchronized Order/Product
 * collections — nothing here is AI-generated or estimated. Cancelled orders are excluded from
 * revenue figures so gross sales reflects orders that actually stand.
 */
export async function getStoreOverview(storeId: string, tenantId: string): Promise<StoreOverview> {
  await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();

  const storeObjectId = new Types.ObjectId(storeId);
  const trendStart = new Date();
  trendStart.setUTCHours(0, 0, 0, 0);
  trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));

  const [summary, financialStatusBreakdown, productStatusBreakdown, topProducts, productSales, inventoryProducts, sampleOrder, dailyTrendRows] =
    await Promise.all([
      Order.aggregate([
        { $match: { storeId: storeObjectId, cancelledAt: null } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            grossSales: { $sum: "$totalPrice" },
            totalDiscounts: { $sum: "$totalDiscounts" },
            averageOrderValue: { $avg: "$totalPrice" },
          },
        },
      ]),
      Order.aggregate([
        { $match: { storeId: storeObjectId, cancelledAt: null } },
        { $group: { _id: { $ifNull: ["$financialStatus", "unknown"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Product.aggregate([
        { $match: { storeId: storeObjectId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        { $match: { storeId: storeObjectId, cancelledAt: null } },
        { $unwind: "$lineItems" },
        {
          $group: {
            _id: "$lineItems.shopifyProductId",
            title: { $first: "$lineItems.title" },
            quantitySold: { $sum: "$lineItems.quantity" },
            revenue: { $sum: { $multiply: ["$lineItems.price", "$lineItems.quantity"] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { storeId: storeObjectId, cancelledAt: null } },
        { $unwind: "$lineItems" },
        { $match: { "lineItems.shopifyProductId": { $ne: null } } },
        {
          $group: {
            _id: "$lineItems.shopifyProductId",
            quantitySold: { $sum: "$lineItems.quantity" },
            revenue: { $sum: { $multiply: ["$lineItems.price", "$lineItems.quantity"] } },
          },
        },
      ]),
      Product.find({ storeId: storeObjectId, status: "active" })
        .select("shopifyProductId title variants.title variants.inventoryQuantity")
        .lean(),
      Order.findOne({ storeId: storeObjectId }).select("currency").lean(),
      Order.aggregate([
        { $match: { storeId: storeObjectId, cancelledAt: null, shopifyCreatedAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$shopifyCreatedAt" } },
            orders: { $sum: 1 },
            grossSales: { $sum: "$totalPrice" },
            totalDiscounts: { $sum: "$totalDiscounts" },
            averageOrderValue: { $avg: "$totalPrice" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const base = summary[0] ?? { totalOrders: 0, grossSales: 0, totalDiscounts: 0, averageOrderValue: 0 };
  const statusCounts = financialStatusBreakdown.map((row) => ({
    status: String(row._id).toLowerCase(),
    count: row.count,
  }));
  const paidStatuses = new Set(["paid"]);
  const unpaidStatuses = new Set(["pending", "authorized", "partially_paid", "partially paid"]);
  const paymentStatusSummary = statusCounts.reduce(
    (totals, row) => {
      if (paidStatuses.has(row.status)) totals.paid += row.count;
      else if (unpaidStatuses.has(row.status)) totals.unpaid += row.count;
      else totals.other += row.count;
      return totals;
    },
    { paid: 0, unpaid: 0, other: 0 }
  );
  const salesById = new Map(
    productSales.map((row: { _id: string; quantitySold: number; revenue: number }) => [
      row._id,
      { quantitySold: row.quantitySold, revenue: row.revenue },
    ] as const)
  );
  const inventoryById = new Map(inventoryProducts.map((product) => {
    const variants = product.variants ?? [];
    const knownUnits = variants.reduce((sum, variant) => sum + (variant.inventoryQuantity ?? 0), 0);
    const lowStockVariants = variants.filter((variant) =>
      variant.inventoryQuantity !== null && variant.inventoryQuantity > 0 && variant.inventoryQuantity <= 5
    ).length;
    return [product.shopifyProductId, { knownUnits, lowStockVariants }] as const;
  }));
  const catalogPerformance = inventoryProducts.map((product) => {
    const sales = salesById.get(product.shopifyProductId) ?? { quantitySold: 0, revenue: 0 };
    const inventory = inventoryById.get(product.shopifyProductId);
    const hasUntrackedVariant = product.variants.some((variant) => variant.inventoryQuantity === null);
    return {
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      quantitySold: sales.quantitySold,
      revenue: sales.revenue,
      inventoryUnits: hasUntrackedVariant ? null : inventory?.knownUnits ?? 0,
      lowStockVariants: inventory?.lowStockVariants ?? 0,
    };
  });
  const variantInventory = inventoryProducts.flatMap((product) =>
    product.variants.map((variant) => ({
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      variant: variant.title || "Default",
      quantity: variant.inventoryQuantity,
    }))
  );
  const lowStockVariants = variantInventory.filter((variant) =>
    variant.quantity !== null && variant.quantity > 0 && variant.quantity <= 5
  );
  const outOfStockVariants = variantInventory.filter((variant) =>
    variant.quantity !== null && variant.quantity <= 0
  );

  return {
    currency: sampleOrder?.currency ?? "USD",
    totalOrders: base.totalOrders,
    grossSales: base.grossSales,
    totalDiscounts: base.totalDiscounts,
    averageOrderValue: base.averageOrderValue,
    ordersByFinancialStatus: statusCounts,
    paymentStatusSummary,
    productsByStatus: productStatusBreakdown.map((r) => ({ status: r._id, count: r.count })),
    topProductsByRevenue: topProducts.map((r) => ({
      shopifyProductId: r._id,
      title: r.title,
      quantitySold: r.quantitySold,
      revenue: r.revenue,
    })),
    bestSellingProducts: [...catalogPerformance]
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue || a.title.localeCompare(b.title))
      .slice(0, 5),
    slowestSellingProducts: [...catalogPerformance]
      .sort((a, b) => a.quantitySold - b.quantitySold || a.revenue - b.revenue || a.title.localeCompare(b.title))
      .slice(0, 5),
    inventorySummary: {
      trackedVariants: variantInventory.filter((variant) => variant.quantity !== null).length,
      lowStockVariants: lowStockVariants.length,
      outOfStockVariants: outOfStockVariants.length,
      untrackedVariants: variantInventory.filter((variant) => variant.quantity === null).length,
      lowStockProducts: lowStockVariants.slice(0, 10).map((variant) => ({
        shopifyProductId: variant.shopifyProductId,
        title: variant.title,
        variant: variant.variant,
        quantity: variant.quantity as number,
      })),
      outOfStockProducts: outOfStockVariants.slice(0, 10).map((variant) => ({
        shopifyProductId: variant.shopifyProductId,
        title: variant.title,
        variant: variant.variant,
      })),
    },
    dailyTrend: zeroFillTrend(dailyTrendRows),
  };
}
