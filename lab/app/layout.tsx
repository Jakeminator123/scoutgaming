import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import './scout-theme.css';
import { WorkspaceNavigation } from '@/components/workspace-navigation';

const display = Space_Grotesk({ subsets: ['latin', 'latin-ext'], weight: '600', variable: '--sg-next-display', display: 'swap' });
const body = Inter({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--sg-next-body', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], variable: '--sg-next-mono', display: 'swap' });
const themeBoot = `try{var t=localStorage.getItem('sg-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export const metadata: Metadata = {
  title: 'Croupier Studio · Scout Gaming',
  description: 'Studio för klipp, regler, konton, drift och OpenClaw.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv" data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
    <body>
      <Script id="sg-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBoot }} />
      <WorkspaceNavigation>{children}</WorkspaceNavigation>
    </body>
  </html>;
}
