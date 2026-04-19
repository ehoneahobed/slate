"use server";

import { signOutSession } from "@/auth";

export async function signOutAction() {
  await signOutSession("/");
}
