import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
import {studioHistoryBootstrap} from '@/lib/studio-history.mjs';
import './globals.css';
import './scout-theme.css';
import { WorkspaceNavigation } from '@/components/workspace-navigation';

// Local variable fonts (app/fonts/README.md). Builds no longer depend on fonts.googleapis.com.
const display = localFont({ src: './fonts/space-grotesk-latin-wght-normal.woff2', weight: '300 700', variable: '--sg-next-display', display: 'swap' });
const body = localFont({ src: './fonts/inter-latin-wght-normal.woff2', weight: '100 900', variable: '--sg-next-body', display: 'swap' });
const mono = localFont({ src: './fonts/jetbrains-mono-latin-wght-normal.woff2', weight: '100 800', variable: '--sg-next-mono', display: 'swap' });
const themeBoot = `try{var t=localStorage.getItem('sg-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export const metadata: Metadata = {
  title: 'Croupier Studio · Scout Gaming',
  description: 'Studio för klipp, regler, konton, drift och OpenClaw.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
    <body>
      <Script id="sg-history" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: studioHistoryBootstrap }} />
      <Script id="sg-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBoot }} />
      <WorkspaceNavigation>{children}</WorkspaceNavigation>
      <Script src={(process.env.CROUPIER_LAB_BASE_PATH || '') + '/assistant-widget.js'} strategy="afterInteractive" />
    </body>
  </html>;
}
