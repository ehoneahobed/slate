"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await authClient.signUp.email({
        name: name.trim() || "",
        email: email.trim(),
        password,
        callbackURL: "/dashboard",
      });
      if (err) {
        setError(err.message ?? "Could not create account.");
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] p-6 shadow-[var(--shadow-2)]">
      <div>
        <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl">Create account</h1>
        <p className="mt-1 text-sm text-[var(--ink-3)]">Teachers use email and a password. You can add magic link sign-in from the login page anytime.</p>
      </div>
      {error && <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}
      <form className="space-y-3" onSubmit={onSubmit}>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]" htmlFor="name">
            Name (optional)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </div>
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-[var(--ink)] py-2.5 text-sm font-semibold text-[var(--paper)] disabled:opacity-50"
        >
          Create account
        </button>
      </form>
      <p className="text-center text-sm text-[var(--ink-3)]">
        Already have an account?{" "}
        <Link className="font-semibold text-[var(--ink)] underline" href="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
