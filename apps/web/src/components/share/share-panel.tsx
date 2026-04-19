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
};

export function SharePanel({ notebookId, links }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Could not copy — select the link manually.");
    }
    window.setTimeout(() => setMessage(null), 3500);
  }

  return (
    <div className="rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-[var(--shadow-1)]">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--ink-3)]">Read-only share</h2>
      <p className="mt-1 text-xs text-[var(--ink-3)]">
        Anyone with the link can view this notebook. The secret token is only shown once when you create a link.
      </p>

      <button
        type="button"
        disabled={pending}
        className="mt-3 rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-[var(--paper)] disabled:opacity-50"
        onClick={() =>
          start(async () => {
            setMessage(null);
            const { url } = await createShareLinkAction(notebookId);
            await copyText(url);
            router.refresh();
          })
        }
      >
        Create new link & copy
      </button>

      {message && <p className="mt-2 text-xs text-[var(--ink-2)]">{message}</p>}

      {links.length > 0 && (
        <div className="mt-4 border-t border-[var(--chrome-b)] pt-3">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Active links</div>
          <ul className="mt-2 space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-2 py-2">
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
