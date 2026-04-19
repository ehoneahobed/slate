import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth as betterAuth } from "@/lib/auth";

export { betterAuth as auth };

/** Server session (Better Auth). Replaces the old NextAuth `auth()` helper name-wise via `getSession`. */
export async function getSession() {
  return betterAuth.api.getSession({ headers: await headers() });
}

export async function signOutSession(redirectTo = "/") {
  await betterAuth.api.signOut({ headers: await headers() });
  redirect(redirectTo);
}
