'use client';

import { useState, type ReactNode } from 'react';
import styles from './presentation-frame.module.css';

export function PresentationFrame({ children, label, captured = false }: { children: ReactNode; label: string; captured?: boolean }) {
  const [format, setFormat] = useState<'desktop' | 'mobile'>('desktop');
  return <div className={styles.frame} data-presentation-format={format} data-presentation-source={captured ? 'capture' : 'dealer'}>
    <div className={styles.controls} role="group" aria-label={`${label} · visningsram`}>
      <span>Visningsram</span><button type="button" aria-pressed={format === 'desktop'} onClick={() => setFormat('desktop')}>Dator · 16:9</button>
      <button type="button" aria-pressed={format === 'mobile'} onClick={() => setFormat('mobile')}>Mobil · 9:16</button>
    </div>
    <div className={styles.content}>{children}</div>
    <p className={styles.note}>{captured ? 'Ramen ändrar inte spelflikens layout. Anpassa spelflikens fönster för ett riktigt mobilprov.' : 'Dealern behåller samma storlek i båda ramarna. Dator visar mer åt sidorna; mobil visar ett centrerat utsnitt.'}</p>
  </div>;
}
