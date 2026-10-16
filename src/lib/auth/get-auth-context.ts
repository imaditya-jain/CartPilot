import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { ApiError } from "@/lib/utils/api-response";

export interface AuthContext {
  userId: string;
  email: string;
}

/** Returns the authenticated user from the access-token cookie, or null if absent/invalid. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const token = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return { userId: payload.sub, email: payload.email };
}

/** Same as getAuthContext but throws a 401 ApiError — use at the top of protected route handlers. */
export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new ApiError(401, "UNAUTHENTICATED", "You must be signed in to perform this action.");
  }
  return context;
}
