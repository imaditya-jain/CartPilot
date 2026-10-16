import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Order } from "@/models/Order";
import { requireOwnedStore } from "@/services/store-service";

export interface CustomerSummary {
  customerId: string;
  email: string | null;
  name: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date;
}

interface CustomerAggregateRow {
  _id: string;
  email: string | null;
  name: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date;
}

/**
 * Distinct customers derived from synchronized orders — there is no separate Customer model,
 * Shopify's customer identity is only ever attached to the orders it placed.
 */
export async function listCustomersForStore(storeId: string, tenantId: string): Promise<CustomerSummary[]> {
  await requireOwnedStore(storeId, tenantId);
  await connectToDatabase();

  const storeObjectId = new Types.ObjectId(storeId);
  const rows: CustomerAggregateRow[] = await Order.aggregate([
    { $match: { storeId: storeObjectId, cancelledAt: null, customerId: { $ne: null } } },
    {
      $group: {
        _id: "$customerId",
        email: { $first: "$customerEmail" },
        name: { $first: "$customerName" },
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$totalPrice" },
        lastOrderAt: { $max: "$shopifyCreatedAt" },
      },
    },
    { $sort: { lastOrderAt: -1 } },
  ]);

  return rows.map((row) => ({
    customerId: row._id,
    email: row.email,
    name: row.name,
    orderCount: row.orderCount,
    totalSpent: row.totalSpent,
    lastOrderAt: row.lastOrderAt,
  }));
}
