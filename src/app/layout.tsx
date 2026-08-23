import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./components.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const thurkle = localFont({
  src: "./fonts/Thurkle.ttf",
  variable: "--font-thurkle",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'Elections — StruktHQ',
  description: 'Browse active, upcoming, and past elections.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${thurkle.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla)
          inject attributes like cz-shortcut-listen onto <body> before
          React hydrates — a benign client/server mismatch, not app state. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
