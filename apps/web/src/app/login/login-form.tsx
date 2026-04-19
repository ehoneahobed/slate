"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

function safeCallback(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

type LoginFormProps = {
  showGithub: boolean;
};

export function LoginForm({ showGithub }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = safeCallback(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onPasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL,
      });
      if (err) {
        setError(err.message ?? "Could not sign in.");
        setBusy(false);
        return;
      }
      router.push(callbackURL);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const { error: err } = await authClient.signIn.magicLink({
        email: magicEmail.trim(),
        callbackURL,
      });
      if (err) {
        setError(err.message ?? "Could not send link.");
        setBusy(false);
        return;
      }
      setMessage("Check your email for a sign-in link.");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onGitHub() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL,
      });
    } catch {
      setError("GitHub sign-in is not available or failed to start.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-8 rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] p-6 shadow-[var(--shadow-2)]">
      <div>
        <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--ink-3)]">Use your email — password, magic link, or GitHub.</p>
      </div>

      {error && <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}
      {message && <p className="rounded-md border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--ink-2)]">{message}</p>}

      <form className="space-y-3" onSubmit={onPasswordSignIn}>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[var(--ink)] py-2.5 text-sm font-semibold text-[var(--paper)] disabled:opacity-50"
        >
          Sign in with password
        </button>
      </form>

      <div className="relative border-t border-[var(--rule)] pt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Magic link (no password)</p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onMagicLink}>
          <input
            type="email"
            required
            placeholder="you@school.edu"
            value={magicEmail}
            onChange={(ev) => setMagicEmail(ev.target.value)}
            className="min-w-0 flex-1 rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            Email me a link
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--ink-4)]">In local dev without Resend, the link is printed in the server terminal.</p>
      </div>

      {showGithub && (
        <div className="border-t border-[var(--rule)] pt-6">
          <button
            type="button"
            disabled={busy}
            onClick={onGitHub}
            className="w-full rounded-md border border-[var(--chrome-b)] py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            Continue with GitHub
          </button>
        </div>
      )}

      <p className="text-center text-sm text-[var(--ink-3)]">
        New here?{" "}
        <Link className="font-semibold text-[var(--ink)] underline" href="/signup">
          Create an account
        </Link>
      </p>
      <p className="text-center text-sm">
        <Link className="text-[var(--ink-3)] hover:underline" href="/">
          ← Back home
        </Link>
      </p>
    </div>
  );
}
