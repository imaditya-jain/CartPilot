import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { getOrderById } from "@/services/order-service";
import { ok, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthContext();
    const { order, lineItemsEnriched } = await getOrderById(params.id, auth.userId);

    return ok({
      id: order._id.toString(),
      name: order.name,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      cancelledAt: order.cancelledAt,
      currency: order.currency,
      subtotalPrice: order.subtotalPrice,
      totalDiscounts: order.totalDiscounts,
      totalPrice: order.totalPrice,
      lineItems: lineItemsEnriched,
      shopifyCreatedAt: order.shopifyCreatedAt,
      shopifyUpdatedAt: order.shopifyUpdatedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
