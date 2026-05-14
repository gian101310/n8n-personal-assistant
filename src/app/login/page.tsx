import { LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAction } from "./actions";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) || {};
  const message =
    params.error === "invalid"
      ? "Password did not match."
      : params.error === "not-configured"
        ? "Dashboard auth env vars are missing."
        : "";

  return (
    <main className="loginShell">
      <section className="loginPanel">
        <div className="loginMark">
          <ShieldCheck size={28} />
        </div>
        <p className="eyebrow">Private Dashboard</p>
        <h1>Admin Login</h1>
        <p className="loginCopy">Access your expenses, tasks, reminders, and assistant logs.</p>
        <form className="loginForm" action={loginAction}>
          <input type="hidden" name="next" value={params.next || "/"} />
          <label htmlFor="password">Password</label>
          <div className="passwordField">
            <LockKeyhole size={18} />
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {message ? <p className="formError">{message}</p> : null}
          <button className="primaryButton" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
