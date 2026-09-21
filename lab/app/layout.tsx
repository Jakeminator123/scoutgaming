import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Croupier Lab · Scout Gaming',
  description: 'Scout Gamings lokala labb för events, regler, uttryck och videobindningar.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
