import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = [
  "/admin",
  "/calendar",
  "/contact",
  "/dashboard",
  "/emotions",
  "/import",
  "/journal",
  "/onboarding",
  "/playbooks",
  "/portfolio",
  "/referrals",
  "/reports",
  "/resources",
  "/settings",
  "/trades"
];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasClerkSession =
    request.cookies.has("__session") ||
    request.cookies.has("__clerk_db_jwt") ||
    request.headers.has("authorization");

  const allowLocalSampleMode = process.env.NODE_ENV !== "production" && !process.env.AUTH_PROVIDER_SECRET;

  if (hasClerkSession || allowLocalSampleMode) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect_url", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/calendar/:path*",
    "/contact/:path*",
    "/dashboard/:path*",
    "/emotions/:path*",
    "/import/:path*",
    "/journal/:path*",
    "/onboarding/:path*",
    "/playbooks/:path*",
    "/portfolio/:path*",
    "/referrals/:path*",
    "/reports/:path*",
    "/resources/:path*",
    "/settings/:path*",
    "/trades/:path*"
  ]
};
