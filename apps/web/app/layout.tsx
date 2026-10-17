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

const cormorant = localFont({
  src: "./fonts/CormorantGaramond-Variable.woff2",
  weight: "400 600",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Times New Roman",
  variable: "--font-cormorant",
})

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Scout Gaming Group · Blackjackpilot med Astrid",
  description:
    "Möt Astrid i en blackjackpilot med serverstyrt spel och demokrediter. Inga riktiga pengar.",
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
    <html lang="sv" className={`${inter.variable} ${cormorant.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <Script src="/studio/assistant-widget.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
