import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

export const ACCESS_TOKEN_COOKIE = "cp_access_token";
export const REFRESH_TOKEN_COOKIE = "cp_refresh_token";

function baseCookieOptions() {
  const env = getServerEnv();
  return {
    httpOnly: true as const,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setAccessTokenCookie(token: string) {
  const env = getServerEnv();
  cookies().set(ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions(),
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  });
}

export function setRefreshTokenCookie(token: string) {
  const env = getServerEnv();
  cookies().set(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    path: "/api/auth",
  });
}

export function clearAuthCookies() {
  const options = baseCookieOptions();
  cookies().set(ACCESS_TOKEN_COOKIE, "", { ...options, maxAge: 0 });
  cookies().set(REFRESH_TOKEN_COOKIE, "", { ...options, maxAge: 0, path: "/api/auth" });
}
