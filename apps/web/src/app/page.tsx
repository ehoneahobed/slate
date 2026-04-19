import type { Metadata } from "next";
import { getSession } from "@/auth";
import { LandingView } from "@/components/landing/landing-view";

export const metadata: Metadata = {
  title: "Slate — Notebook-first whiteboard for teachers",
  description:
    "Notebooks, sections, and pages with pen and highlighter. Publish read-only share links. Built for teachers; early access.",
};

export default async function Home() {
  const session = await getSession();
  return <LandingView signedIn={Boolean(session?.user)} />;
}
