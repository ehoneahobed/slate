import type { Metadata } from "next";
import { Caveat, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { getSession } from "@/auth";
import { getUserTheme } from "@/lib/user-settings";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Slate",
  description: "Notebook-first whiteboard for teachers",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const theme = session?.user?.id ? await getUserTheme(session.user.id) : "paper";

  // Extensions sometimes inject attributes on `html` / `body` before hydration (e.g. `cz-shortcut-listen`).
  // `suppressHydrationWarning` on those nodes silences attribute-only mismatches; it does not apply to children.
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
