import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { shareLinks } from "@/lib/db/schema";
import { hashShareToken } from "./token";

export type ActiveShareLink = typeof shareLinks.$inferSelect;

/**
 * Resolves a raw URL token to an active share row, or null if missing / revoked / expired.
 */
export async function resolveActiveShareLink(rawToken: string): Promise<ActiveShareLink | null> {
  const tokenHash = hashShareToken(rawToken.trim());
  const link = await db.query.shareLinks.findFirst({
    where: eq(shareLinks.tokenHash, tokenHash),
  });
  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;
  return link;
}
