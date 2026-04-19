"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/auth";
import { setUserTheme, type UiTheme } from "@/lib/user-settings";

export async function setUserThemeAction(theme: UiTheme) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await setUserTheme(session.user.id, theme);
  revalidatePath("/", "layout");
}
