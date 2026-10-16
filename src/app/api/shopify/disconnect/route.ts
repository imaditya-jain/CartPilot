import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuthContext } from "@/lib/auth/get-auth-context";
import { disconnectStore } from "@/services/store-service";
import { ok, handleApiError } from "@/lib/utils/api-response";

const bodySchema = z.object({ storeId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const { storeId } = bodySchema.parse(await request.json());
    await disconnectStore(storeId, auth.userId);
    return ok({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
}
