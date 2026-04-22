import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans-manrope",
  subsets: ["latin"],
  display: "swap"
});

const sora = Sora({
  variable: "--font-display-sora",
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "I Call On — fast-paced word party game",
  description:
    "Name, Animal, Place, Thing, Food — race your friends to fill every category with words starting with the called letter.",
  metadataBase: new URL("https://icallon.cardgamelobby.com")
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${sora.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
