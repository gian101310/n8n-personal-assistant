"use server";

import { redirect } from "next/navigation";
import { clearAuthCookie, getDashboardPassword, isAuthConfigured, setAuthCookie } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");

  if (!isAuthConfigured()) {
    redirect("/login?error=not-configured");
  }

  if (password !== getDashboardPassword()) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  await setAuthCookie();
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await clearAuthCookie();
  redirect("/login");
}
