"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createShareLinkAction, revokeShareLinkAction } from "@/actions/share-links";

export type ShareLinkRow = {
  id: string;
  mode: string;
  createdAt: Date;
};

type Props = {
  notebookId: string;
  links: ShareLinkRow[];
  /** Tighter layout when nested in the page editor sidebar. */
  embedded?: boolean;
};

export function SharePanel({ notebookId, links, embedded = false }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Could not copy — select the link manually.");
    }
    window.setTimeout(() => setMessage(null), 3500);
  }

  const shell = embedded
    ? "rounded-xl border border-[var(--chrome-b)] bg-[var(--paper-2)] p-4"
    : "rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-[var(--shadow-1)]";

  return (
    <div className={shell}>
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--ink-3)]">Public read-only link</h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-3)]">
        Anyone with the full link can open this notebook in read-only mode without signing in. The link includes a long random segment (the link key)
        that acts like a password: we only store a cryptographic hash of it, not the key itself, so we can never show an existing link again after this
        screen — copy it when you create it, or create a new link later. Set{" "}
        <code className="rounded bg-[var(--paper)] px-1 font-mono text-[10px]">NEXT_PUBLIC_APP_URL</code> in production so copied URLs use your real
        domain.
      </p>

      <button
        type="button"
        disabled={pending}
        className="mt-3 rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-[var(--paper)] disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setMessage(null);
            const { url } = await createShareLinkAction(notebookId);
            setLastCreatedUrl(url);
            await copyText(url);
            router.refresh();
          })
        }
      >
        Create new link & copy
      </button>

      {lastCreatedUrl ? (
        <div className="mt-3 space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Latest link (copy again)</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={lastCreatedUrl}
              className="min-w-0 flex-1 rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-2 py-1.5 font-mono text-[11px] text-[var(--ink)]"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className="shrink-0 rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-2 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
              onClick={() => void copyText(lastCreatedUrl)}
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}

      {message && <p className="mt-2 text-xs text-[var(--ink-2)]">{message}</p>}

      {links.length > 0 && (
        <div className="mt-4 border-t border-[var(--chrome-b)] pt-3">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Active links</div>
          <p className="mt-1 text-[11px] leading-snug text-[var(--ink-4)]">
            You cannot re-copy old links from here because the link key is not stored (only its hash). Revoke a link anytime to turn off access for that
            URL.
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-2 py-2">
                <span className="text-xs text-[var(--ink-3)]">
                  {l.mode} · {l.createdAt.toISOString().slice(0, 10)} · <code className="text-[10px]">{l.id.slice(0, 8)}…</code>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  className="text-xs font-semibold text-[var(--danger)]"
                  onClick={() =>
                    start(async () => {
                      await revokeShareLinkAction(notebookId, l.id);
                      router.refresh();
                    })
                  }
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
