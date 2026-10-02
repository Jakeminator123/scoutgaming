import type { Metadata } from 'next';
import './globals.css';
import { WorkspaceNavigation } from '@/components/workspace-navigation';

export const metadata: Metadata = {
  title: 'Croupier Studio · Scout Gaming',
  description: 'Studio för klipp, regler, konton, drift och OpenClaw.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv" data-scroll-behavior="smooth"><body><WorkspaceNavigation />{children}</body></html>;
}
