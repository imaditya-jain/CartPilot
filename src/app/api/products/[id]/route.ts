import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { getProductById } from "@/services/product-service";
import { stripHtml } from "@/lib/utils/strip-html";
import { ok, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthContext();
    const product = await getProductById(params.id, auth.userId);

    return ok({
      id: product._id.toString(),
      title: product.title,
      handle: product.handle,
      description: stripHtml(product.description),
      status: product.status,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      imageUrls: product.imageUrls,
      variants: product.variants,
      shopifyUpdatedAt: product.shopifyUpdatedAt,
      syncedAt: product.syncedAt,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
