import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { requireOwnedStore } from "@/services/store-service";
import { AiAudit } from "@/models/AiAudit";
import { ChatbotKnowledgeChunk } from "@/models/ChatbotKnowledgeChunk";
import { ok, fail, handleApiError } from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const storeId = request.nextUrl.searchParams.get("storeId");
    if (!storeId) return fail(400, "MISSING_STORE_ID", "storeId query parameter is required.");

    await requireOwnedStore(storeId, auth.userId);
    const requestedOffset = Number.parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10);
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;
    const limit = 50;
    const filter = { tenantId: auth.userId, storeId };
    const [audits, total, knowledgeBatches] = await Promise.all([
      AiAudit.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit)
        .select("operation model generationConfig status inputMessages output errorMessage providerStatus durationMs createdAt")
        .lean(),
      AiAudit.countDocuments(filter),
      ChatbotKnowledgeChunk.find({ storeId })
        .select("kind batchIndex summary sourceData updatedAt")
        .sort({ kind: 1, batchIndex: 1 })
        .lean(),
    ]);

    return ok({ audits, total, nextOffset: offset + audits.length, hasMore: offset + audits.length < total, knowledgeBatches });
  } catch (error) {
    return handleApiError(error);
  }
}
