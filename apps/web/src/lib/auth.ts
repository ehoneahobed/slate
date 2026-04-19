import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

function resolveBaseUrl(): string {
  const u = process.env.BETTER_AUTH_URL?.trim() || process.env.AUTH_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "http://localhost:3010";
}

function resolveSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (s && s.length >= 32) return s;
  /** Dev-only fallback so `next dev` runs without env; production must set BETTER_AUTH_SECRET. */
  return "slate-dev-better-auth-secret-min-32-chars!!";
}

async function sendMagicLinkEmail({ email, url }: { email: string; url: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (key && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Sign in to Slate",
        html: `<p>Click the link below to sign in to Slate:</p><p><a href="${url}">Sign in</a></p><p>If you did not request this, you can ignore this email.</p>`,
      }),
    });
    if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`\n[Slate magic link] ${email}\n${url}\n`);
    return;
  }
  throw new Error("Configure RESEND_API_KEY and EMAIL_FROM to send magic links in production.");
}

const githubClientId = process.env.GITHUB_CLIENT_ID?.trim() || process.env.AUTH_GITHUB_ID?.trim();
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || process.env.AUTH_GITHUB_SECRET?.trim();

export const auth = betterAuth({
  appName: "Slate",
  baseURL: resolveBaseUrl(),
  secret: resolveSecret(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: { enabled: true },
  ...(githubClientId && githubClientSecret
    ? {
        socialProviders: {
          github: { clientId: githubClientId, clientSecret: githubClientSecret },
        },
      }
    : {}),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url });
      },
    }),
    nextCookies(),
  ],
});
