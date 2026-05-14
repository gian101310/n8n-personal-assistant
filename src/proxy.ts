import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = process.env.DASHBOARD_SESSION_TOKEN || "";
  const cookieToken = request.cookies.get(AUTH_COOKIE)?.value || "";

  if (!sessionToken || cookieToken !== sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
