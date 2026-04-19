"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserThemeAction } from "./theme-actions";
import type { UiTheme } from "@/lib/user-settings";

const THEMES: UiTheme[] = ["paper", "clean", "dark"];

export function ThemeSwitcher({ initial }: { initial: UiTheme }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] p-1">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setUserThemeAction(t);
              router.refresh();
            })
          }
          className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${
            initial === t ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
