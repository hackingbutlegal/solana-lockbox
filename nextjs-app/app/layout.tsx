import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "../components/layout";
import { LoadingScreen } from "../components/ui/LoadingScreen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solana Lockbox - Blockchain Password Manager",
  description: "Open-source password manager with blockchain storage on Solana. Client-side encryption, wallet-only access. Built by Web3 Studios LLC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* BUGFIX: Static loader with suppressHydrationWarning to prevent hydration mismatch */}
        {/* This div is removed by LoadingScreen component after React hydrates */}
        <div id="static-loader" suppressHydrationWarning>
          <div className="loader-content">
            <div className="loader-icon">🔐</div>
            <h1 className="loader-title">Solana Lockbox</h1>
            <p className="loader-tagline">Blockchain Password Manager</p>
          </div>
        </div>
        <LoadingScreen />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
