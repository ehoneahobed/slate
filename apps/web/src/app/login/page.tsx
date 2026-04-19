import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const ghId = process.env.GITHUB_CLIENT_ID?.trim() || process.env.AUTH_GITHUB_ID?.trim();
  const ghSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || process.env.AUTH_GITHUB_SECRET?.trim();
  const showGithub = Boolean(ghId && ghSecret);

  return (
    <div className="min-h-dvh bg-[var(--bg)] px-4 py-16 text-[var(--ink)]">
      <Suspense fallback={<div className="mx-auto max-w-md text-center text-sm text-[var(--ink-3)]">Loading…</div>}>
        <LoginForm showGithub={showGithub} />
      </Suspense>
    </div>
  );
}
