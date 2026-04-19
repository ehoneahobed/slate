import { createHash, randomBytes } from "node:crypto";

/** URL-safe opaque token (raw secret — only shown once at creation). */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}
