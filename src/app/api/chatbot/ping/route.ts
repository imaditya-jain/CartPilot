import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Store } from "@/models/Store";
import { chatbotPingSchema } from "@/lib/validation/chatbot-ping";
import { isValidObjectId } from "@/services/shopify-sync-service";
import { rateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated heartbeat: the embedded loader script (public/chatbot/loader.js) fires
 * this once per real storefront page load via navigator.sendBeacon, which never reads the
 * response — so this always returns 204 regardless of outcome, and never blocks or throws in a
 * way that could surface in a shopper's browser console.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = chatbotPingSchema.safeParse(await request.json());
    if (!parsed.success || !isValidObjectId(parsed.data.storeId)) {
      return new NextResponse(null, { status: 204 });
    }
    const { storeId } = parsed.data;

    const limit = rateLimit(`widget-ping:${storeId}`, 30, 5 * 60 * 1000);
    if (!limit.success) {
      return new NextResponse(null, { status: 204 });
    }

    await connectToDatabase();
    await Store.updateOne({ _id: storeId }, { $set: { lastWidgetPingAt: new Date() } });
  } catch (error) {
    console.error("Widget ping failed:", error);
  }

  return new NextResponse(null, { status: 204 });
}
