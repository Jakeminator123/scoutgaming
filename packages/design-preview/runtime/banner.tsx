import type { ReactNode } from 'react';
export function PreviewBanner({ lobby = false, children }: { lobby?: boolean; children?: ReactNode }) {
  return <div className="preview-banner" role="region" aria-label="Arbetsversion">
    <strong>Arbetsversion · testdata</strong>
    <span>Ändringar sparas bara tills sidan laddas om. Ingen spelstart eller publicering.</span>
    <a href={lobby ? '/admin/structure' : '/admin/lobby'}>{lobby ? 'Administration' : 'Visa spellobby'} ↗</a>
    <a href="/control">Nuvarande Control ↗</a>
    {children}
  </div>;
}
