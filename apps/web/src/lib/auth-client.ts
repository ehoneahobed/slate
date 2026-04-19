"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Resolve the Better Auth client `baseURL` so browser calls always hit the **current** origin
 * (`/api/auth/...`). That avoids mismatches when `NEXT_PUBLIC_AUTH_URL` / similar points at another host
 * while you are developing on localhost or a LAN URL.
 */
function authClientBaseUrl(): string | undefined {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (app) return `${app}/api/auth`;
  return undefined;
}

export const authClient = createAuthClient({
  baseURL: authClientBaseUrl(),
  plugins: [magicLinkClient()],
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
});
