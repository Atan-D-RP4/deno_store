import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "@/components/authContext.tsx";
import Header from "@/components/layout/Header.tsx";
import Footer from "@/components/layout/Footer.tsx";

// Font setup at module scope (important for hydration consistency)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// import process from "node:process";
// const { SITE_NAME } = process.env;

/**
 * Static metadata — handled automatically by Next.js
 * Avoids manually editing <head>
 */
export const metadata: Metadata = {
  title: "Deno Store - Secure Authentication",
  description:
    "Secure login and registration page for accessing your dashboard. Sign in or sign up to get started.",
  keywords: [
    "login",
    "registration",
    "secure authentication",
    "dashboard access",
  ],
  robots: "index, follow",
  icons: {
    icon: "/favicon.ico",
  },
};
// Viewport settings export
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-br from-slate-50 to-blue-100`}
      >
        <AuthProvider>
          <Header />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
