import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERPHigh — Enterprise Solution Generator",
  description: "AI researches, reasons, and builds you a visual enterprise workflow. Review free, pay $1 only if you like it.",
  metadataBase: new URL("https://erphigh.vercel.app"),
  openGraph: {
    title: "ERPHigh — Enterprise Solution Generator",
    description: "AI researches, reasons, and builds you a visual enterprise workflow.",
    url: "https://erphigh.vercel.app",
    siteName: "ERPHigh",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
