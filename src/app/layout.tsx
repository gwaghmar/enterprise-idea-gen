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
  title: "PilotPlan — AI Solution Architect for your business",
  description: "Describe your business problem. AI researches real tools, prices, and community feedback, then builds a step-by-step pilot plan you can hand to your team. Free.",
  metadataBase: new URL("https://pilotplan.vercel.app"),
  openGraph: {
    title: "PilotPlan — AI Solution Architect for your business",
    description: "Describe your business problem. AI researches real tools and prices, then builds a step-by-step pilot plan.",
    url: "https://pilotplan.vercel.app",
    siteName: "PilotPlan",
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
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto border-t border-white/10 bg-black px-4 py-6">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/35">
            <span>© 2026 PilotPlan · Govind Waghmare · All rights reserved</span>
            <span className="flex items-center gap-4">
              <a href="/about" className="hover:text-white/70 transition-colors">About</a>
              <span>Reports are informational, not professional advice</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
