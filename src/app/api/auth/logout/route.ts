import { cookies } from "next/headers";
import { REFRESH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth/cookies";
import { getSessionIdFromRefreshToken, revokeSessionById } from "@/services/session-service";
import { ok, handleApiError } from "@/lib/utils/api-response";
import { connectToDatabase } from "@/lib/mongodb";

export async function POST() {
  try {
    await connectToDatabase();
    const rawRefreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;

    if (rawRefreshToken) {
      const session = await getSessionIdFromRefreshToken(rawRefreshToken);
      if (session) {
        await revokeSessionById(session.sessionId);
      }
    }

    clearAuthCookies();
    return ok({ loggedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
