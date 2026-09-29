import type React from "react"
import type { Metadata, Viewport } from "next"
import { Cormorant_Garamond, Geist_Mono, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
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
      </body>
    </html>
  )
}
