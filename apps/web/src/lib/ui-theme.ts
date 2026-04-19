import { useSyncExternalStore } from "react";
import type { UiTheme } from "@/lib/user-settings"; // type-only

function readThemeAttr(): UiTheme {
  if (typeof document === "undefined") return "paper";
  const v = document.documentElement.getAttribute("data-theme");
  if (v === "dark" || v === "clean") return v;
  return "paper";
}

function subscribeTheme(onStoreChange: () => void) {
  const el = document.documentElement;
  const mo = new MutationObserver(onStoreChange);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/**
 * Tracks `html[data-theme]` for client components (e.g. ink swatches).
 * Pass `serverSnapshot` from a Server Component so the first paint matches SSR (avoids hydration drift).
 */
export function useUiTheme(serverSnapshot?: UiTheme): UiTheme {
  return useSyncExternalStore(subscribeTheme, readThemeAttr, () => serverSnapshot ?? "paper");
}
