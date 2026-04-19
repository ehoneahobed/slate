import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/auth";
import { getUserTheme } from "@/lib/user-settings";
import { signOutAction } from "./sign-out";
import { ThemeSwitcher } from "./theme-switcher";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const theme = await getUserTheme(session.user.id);

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--ink)] print:min-h-0 print:bg-white">
      <header className="border-b border-[var(--chrome-b)] bg-[var(--chrome)] px-6 py-4 print:hidden">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <a href="/dashboard" className="font-[family-name:var(--font-instrument-serif)] text-xl">
            Slate
          </a>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-2)]">
            <ThemeSwitcher initial={theme} />
            <span className="max-w-[200px] truncate">{session.user.email ?? session.user.name ?? "Signed in"}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--paper-2)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] touch-pan-y px-6 py-8 print:mx-0 print:max-w-none print:px-4 print:py-0">
        {children}
      </div>
    </div>
  );
}
