import Link from 'next/link';

export const metadata = { title: 'Spelaryta · Scoutgaming' };

export default function PlayerArea() {
  return <main className="min-h-screen bg-[#0b151b] px-6 py-14 text-white">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm text-slate-300">← Scoutgaming</Link>
      <p className="mt-12 text-sm uppercase tracking-widest text-emerald-300">Spelaryta</p>
      <h1 className="mt-3 text-4xl font-semibold">Välj spel</h1>
      <p className="mt-4 text-slate-300">Öppna Blackjack. Du loggar in när spelet öppnas om du inte redan har en spelsession.</p>
      <section className="mt-9 rounded-2xl border border-white/15 bg-white/5 p-8" aria-labelledby="blackjack-title">
        <p className="text-4xl" aria-hidden="true">♠</p>
        <h2 id="blackjack-title" className="mt-4 text-2xl font-semibold">Blackjack</h2>
        <p className="mt-3 text-slate-300">Klassiskt kortspel med videodealer.</p>
        <a href="/play/blackjack" className="mt-7 inline-block rounded-lg bg-emerald-300 px-6 py-3 font-semibold text-slate-950">Öppna Blackjack</a>
      </section>
    </div>
  </main>;
}
