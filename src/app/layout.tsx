import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./components.css";
import { Providers } from "./providers";

const dmSans = localFont({
  src: "./fonts/DMSans-Variable.woff2",
  variable: "--font-dm-sans",
  weight: "100 1000",
  style: "normal",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-Variable.woff2",
  variable: "--font-heading-space-grotesk",
  weight: "300 700",
  style: "normal",
  display: "swap",
  preload: false,
});

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-heading-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
});

const manrope = localFont({
  src: "./fonts/Manrope-Variable.woff2",
  variable: "--font-heading-manrope",
  weight: "200 800",
  style: "normal",
  display: "swap",
  preload: false,
});

const nunitoSans = localFont({
  src: "./fonts/NunitoSans-Variable.woff2",
  variable: "--font-heading-nunito-sans",
  weight: "200 1000",
  style: "normal",
  display: "swap",
  preload: false,
});

const rubik = localFont({
  src: "./fonts/Rubik-Variable.woff2",
  variable: "--font-heading-rubik",
  weight: "300 900",
  style: "normal",
  display: "swap",
  preload: false,
});

const sora = localFont({
  src: "./fonts/Sora-Variable.woff2",
  variable: "--font-heading-sora",
  weight: "100 800",
  style: "normal",
  display: "swap",
  preload: false,
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
    <html
      lang="en"
      className={`${dmSans.variable} ${thurkle.variable} ${spaceGrotesk.variable} ${inter.variable} ${manrope.variable} ${nunitoSans.variable} ${rubik.variable} ${sora.variable}`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla)
          inject attributes like cz-shortcut-listen onto <body> before
          React hydrates — a benign client/server mismatch, not app state. */}
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
