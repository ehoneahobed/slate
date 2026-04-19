/** Public absolute URL for share links (no trailing slash). */
export function getShareBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}` : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3010";
}
