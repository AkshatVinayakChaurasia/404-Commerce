import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { HEAD_CLEANUP, THEME_BOOT } from "@/lib/head-cleanup";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
});

export const metadata: Metadata = {
  title: "AscenDex: right offer, right moment",
  description:
    "Decides whether a Koramangala merchant should send an offer, which item, at what discount, and writes it in the customer's own language. PS-01 Commerce.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `${HEAD_CLEANUP};${THEME_BOOT}` }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
