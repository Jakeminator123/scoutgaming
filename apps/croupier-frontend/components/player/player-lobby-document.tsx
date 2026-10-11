import {PlayerLobbyOperator} from './player-lobby-operator';
import type {PlayerAreaModel} from './player-area-document';

export function PlayerLobbyDocument({model}:{model:PlayerAreaModel}) {
  return <main className="min-h-screen bg-[#0b0e0f] text-[#f2f1ed]">
    <div className="mx-auto max-w-7xl px-5 pb-12 sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-6">
        <a href="/" aria-label="Scoutgaming, startsida" className="text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-[#d4f83a]">scout<span className="text-[#d4f83a]">/</span>gaming</a>
        <nav aria-label="Spelarkonto" className="flex flex-wrap items-center gap-5 text-xs text-white/65">
          {model.links.map(link=><a key={link.href} href={link.href} className="inline-flex min-h-11 items-center hover:text-[#d4f83a]">{link.label}</a>)}
          <a href="/" className="inline-flex min-h-11 items-center hover:text-[#d4f83a]">Till startsidan ↗</a>
        </nav>
      </header>
      <div className="relative flex flex-wrap items-end justify-between gap-8 py-10 sm:py-14">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#d4f83a]">Scoutgaming / Spellobby</p>
          <h1 className="mt-5 text-4xl font-medium leading-[1.08] tracking-tight sm:text-6xl">Ditt bolag.<br/><span className="text-[#d4f83a]">Ditt bord.</span></h1>
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/55 sm:text-base">Välj spelbolag och hitta ditt spelrum. Där väljer du dealer och de miljöer som bolaget erbjuder.</p>
        </div>
        <div className="max-w-sm text-xs text-white/55">
          <p className="rounded-full border border-white/15 px-4 py-2">18+ · Demo utan riktiga pengar</p>
          {model.fields.length?<details className="mt-4">
            <summary className="cursor-pointer py-2 text-right text-white/65">Ditt spelkonto</summary>
            <dl className="mt-2 space-y-2 rounded-xl border border-white/10 p-4">{model.fields.map(field=><div key={field.label} className="flex flex-wrap justify-between gap-4"><dt>{field.label}</dt><dd data-field={field.label} className="text-[#f2f1ed]">{field.value}</dd></div>)}</dl>
          </details>:null}
        </div>
      </div>
      {model.notice?<p role="status" className="mb-6 rounded-xl border border-amber-200/20 p-4 text-sm text-amber-100">{model.notice}</p>:null}
      <PlayerLobbyOperator initial={model.operator} playHref={model.primary?.href??'/play/blackjack'} playLabel={model.primary?.label??'Spela Blackjack'} directPlay={!model.primary?.href.startsWith('/player-login')}/>
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/40">
        <p>Utbud och miljöval bestäms av respektive spelbolag.</p>
        <p>Administratör? <a href="/control/preview" className="text-white/65 underline underline-offset-4 hover:text-[#d4f83a]">Provspela i Sammansättning</a> med separat testsaldo.</p>
      </footer>
    </div>
  </main>;
}
