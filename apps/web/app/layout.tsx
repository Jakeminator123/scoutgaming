import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import Script from "next/script"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
})

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Scoutgaming · Live-dealer blackjack för spelbolag",
  description:
    "Live-dealer blackjack för spelbolag.",
}

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv" className={`${inter.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <Script src="/studio/assistant-widget.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
