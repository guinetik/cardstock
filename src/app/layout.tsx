import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "cardstock",
  description: "Hosted kanban over markdown trackers",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="glass"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <div id="field" aria-hidden="true" />
        <header className="glass-topbar flex h-10 shrink-0 items-center justify-between px-4">
          <Link href="/" className="text-sm font-semibold">
            cardstock
          </Link>
          <ThemeToggle />
        </header>
        {children}
      </body>
    </html>
  );
}
