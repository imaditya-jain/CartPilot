import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { generateRandomToken, timingSafeEqual } from "@/lib/auth/crypto";

const STATE_COOKIE = "cp_shopify_oauth_state";
const SHOP_COOKIE = "cp_shopify_oauth_shop";
const STATE_TTL_SECONDS = 10 * 60;

function cookieOptions() {
  const env = getServerEnv();
  return {
    httpOnly: true as const,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/shopify",
    maxAge: STATE_TTL_SECONDS,
  };
}

/** Generates a CSRF nonce for the OAuth flow and stores it (with the target shop) in short-lived cookies. */
export function createOAuthState(shopDomain: string): string {
  const nonce = generateRandomToken(16);
  cookies().set(STATE_COOKIE, nonce, cookieOptions());
  cookies().set(SHOP_COOKIE, shopDomain, cookieOptions());
  return nonce;
}

/**
 * Validates the `state` and `shop` values Shopify echoes back in the OAuth callback against
 * what was stored at the start of the flow, then clears the one-time cookies.
 */
export function verifyAndConsumeOAuthState(providedState: string, providedShop: string): boolean {
  const storedState = cookies().get(STATE_COOKIE)?.value;
  const storedShop = cookies().get(SHOP_COOKIE)?.value;

  cookies().set(STATE_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  cookies().set(SHOP_COOKIE, "", { ...cookieOptions(), maxAge: 0 });

  if (!storedState || !storedShop) return false;
  return timingSafeEqual(storedState, providedState) && timingSafeEqual(storedShop, providedShop);
}
