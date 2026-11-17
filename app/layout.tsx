import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BASE } from "@/lib/base";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Daily",
  description: "Habits, levels and notes",
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Daily", statusBarStyle: "black-translucent" },
  icons: { icon: `${BASE}/icon.svg`, apple: `${BASE}/icon-192.png` },
};

export const viewport: Viewport = {
  themeColor: "#191919",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // keeps the editor above the on-screen keyboard on phones (BlockNote recommendation)
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
