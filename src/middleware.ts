import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/tokens";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/stores",
  "/products",
  "/orders",
  "/analytics",
  "/ai-insights",
  "/settings",
];

/**
 * Server-side route protection for dashboard pages. This only gates page navigation; every
 * sensitive API route independently calls requireAuthContext (and, for store-scoped data,
 * requireStoreOwnership) so a bypassed or misconfigured middleware can never grant data access.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/stores/:path*",
    "/products/:path*",
    "/orders/:path*",
    "/analytics/:path*",
    "/ai-insights/:path*",
    "/settings/:path*",
  ],
};
