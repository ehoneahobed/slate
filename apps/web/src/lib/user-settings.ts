import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";

export type UiTheme = "paper" | "clean" | "dark";

export function isUiTheme(value: string): value is UiTheme {
  return value === "paper" || value === "clean" || value === "dark";
}

export async function getUserTheme(userId: string): Promise<UiTheme> {
  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  const t = row?.theme;
  if (t && isUiTheme(t)) return t;
  return "paper";
}

export async function setUserTheme(userId: string, theme: UiTheme): Promise<void> {
  await db
    .insert(userSettings)
    .values({ userId, theme, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { theme, updatedAt: new Date() },
    });
}
