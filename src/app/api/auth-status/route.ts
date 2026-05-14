import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-constants";

export async function GET(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE}=`));
  const cookieValue = cookie?.split("=").slice(1).join("=") || "";
  const token = process.env.DASHBOARD_SESSION_TOKEN || "";

  return NextResponse.json({
    hasToken: Boolean(token),
    hasCookie: Boolean(cookieValue),
    matches: Boolean(token && cookieValue === token),
  });
}
