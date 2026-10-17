'use client';
import { labUrl } from "../lib/lab-url.mjs";
import { useEffect, useRef, useState } from 'react';

type Health = 'checking' | 'ready' | 'unready' | 'unreachable';

async function readHealth(): Promise<Health> {
  try {
    const response = await fetch(labUrl('/api/health'), { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(4000) });
    if (!response.ok) return 'unready';
    const result = await response.json().catch(() => null);
    return result?.ok === true && result?.service === 'croupier-next-studio' ? 'ready' : 'unready';
  } catch { return 'unreachable'; }
}

const healthText: Record<Health, string> = {
  checking: 'Kontrollerar anslutningen till Studio…',
  ready: 'Studio-servern svarar. Ladda om hela sidan för att försöka igen.',
  unready: 'Studio-servern svarar, men kunde inte bekräfta att tjänsten är redo. Försök igen om en stund.',
  unreachable: 'Kunde inte nå Studio-servern. Kontrollera anslutningen och försök igen.',
};

export default function ErrorPage({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const [health, setHealth] = useState<Health>('checking');
  const request = useRef<Promise<Health> | null>(null);
  useEffect(() => {
    let active = true;
    // Reuse the one read when development Strict Mode repeats the effect.
    request.current ??= readHealth();
    void request.current.then(result => { if (active) setHealth(result); });
    return () => { active = false; };
  }, []);
  const reference = typeof error.digest === 'string' && /^[a-f0-9]{6,64}$/i.test(error.digest) ? error.digest : null;
  return <main style={{ padding: 'clamp(24px, 5vw, 48px)', color: '#edf5f5', background: '#10171d', minHeight: '100vh' }}>
    <h1>Studio kunde inte läsas</h1>
    <p role="status">{healthText[health]}</p>
    <p>Omladdningen ändrar inte sparade inställningar. Osparade ändringar kan gå förlorade.</p>
    <button className="primary-button" onClick={() => window.location.reload()}>Ladda om hela sidan</button>
    {reference ? <p><small>Felreferens: <code>{reference}</code></small></p> : null}
  </main>;
}
