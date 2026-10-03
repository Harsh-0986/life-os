import type { Metadata } from "next";
import { Archivo } from "next/font/google";

import "./globals.css";

/*
  One family, pushed hard on weight, width, and tracking.

  Archivo is a grotesque with a slightly condensed skeleton, which reads as
  stamped film-sleeve text when tracked out and set small. Using one family
  avoids the display/body split that most generated pages reach for.
*/
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LifeOS",
  description:
    "Lay out your screenshots on one sheet. Gemma reads them together and marks what conflicts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} antialiased`}>{children}</body>
    </html>
  );
}