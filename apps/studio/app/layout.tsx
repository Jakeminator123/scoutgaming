import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import {studioHistoryBootstrap} from '@/lib/studio-history.mjs';
import {themeModeBootstrap} from '@/lib/theme-mode.mjs';
import './globals.css';
import './scout-theme.css';

// Local variable fonts (app/fonts/README.md). Builds no longer depend on fonts.googleapis.com.
const display = localFont({ src: './fonts/space-grotesk-latin-wght-normal.woff2', weight: '300 700', variable: '--sg-next-display', display: 'swap' });
const body = localFont({ src: './fonts/inter-latin-wght-normal.woff2', weight: '100 900', variable: '--sg-next-body', display: 'swap' });
const mono = localFont({ src: './fonts/jetbrains-mono-latin-wght-normal.woff2', weight: '100 800', variable: '--sg-next-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Croupier Studio · Scout Gaming',
  description: 'Studio för klipp, regler, konton, drift och OpenClaw.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} ${mono.variable} dark`} suppressHydrationWarning>
    <head>
      {/* Mörkt är standard; startskriptet byter till light om det valet är sparat (lib/theme-mode.mjs).
          Ett vanligt skript i <head> körs under HTML-tolkningen, före första målningen; next/script
          beforeInteractive med inline-innehåll köas och körs först när Next startar. */}
      <script id="sg-theme" dangerouslySetInnerHTML={{ __html: themeModeBootstrap }} />
    </head>
    <body>
      <Script id="sg-history" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: studioHistoryBootstrap }} />
      {children}
      <Script src={(process.env.CROUPIER_LAB_BASE_PATH || '') + '/assistant-widget.js'} strategy="afterInteractive" />
    </body>
  </html>;
}
