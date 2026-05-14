import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "./auth-constants";

export function getDashboardPassword() {
  return process.env.DASHBOARD_ADMIN_PASSWORD || "";
}

export function getSessionToken() {
  return process.env.DASHBOARD_SESSION_TOKEN || "";
}

export function isAuthConfigured() {
  return Boolean(getDashboardPassword() && getSessionToken());
}

export async function isAuthenticated() {
  const token = getSessionToken();
  if (!token) return false;
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE)?.value === token;
}

export async function setAuthCookie() {
  const token = getSessionToken();
  if (!token) {
    throw new Error("Missing DASHBOARD_SESSION_TOKEN");
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
}
