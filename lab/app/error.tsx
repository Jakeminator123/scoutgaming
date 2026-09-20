'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main style={{ padding: 48, color: '#edf5f5', background: '#10171d', minHeight: '100vh' }}>
    <h1>Labbet kunde inte läsas</h1>
    <p>Kontrollera den lokala konfigurationen. Din senast sparade version har inte ersatts.</p>
    <button onClick={reset}>Försök igen</button>
  </main>;
}
