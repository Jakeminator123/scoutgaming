import {PlayerLobbyOperator} from './player-lobby-operator';
import type {PlayerAreaModel} from './player-area-document';

const focusClass='focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime';
const facts=[['Spel','Blackjack med serverstyrd giv'],['Dealers','Utvalda av ditt spelbolag'],['Saldo','Demokrediter, inga riktiga pengar']];

export function PlayerLobbyDocument({model}:{model:PlayerAreaModel}) {
  const scoped=Boolean(model.operator);
  return <main className="relative isolate min-h-screen overflow-x-clip bg-ink text-off">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[780px]">
      <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,#000_25%,transparent)]"/>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_80%_0%,rgba(214,255,58,.12),transparent_70%),radial-gradient(ellipse_45%_55%_at_6%_6%,rgba(200,164,106,.10),transparent_70%)]"/>
    </div>
    <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-[1480px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2 sm:px-8 lg:px-10">
        <div className="flex items-center gap-4">
          <a href="/" aria-label="Scoutgaming, startsida" className={'text-xl font-semibold tracking-[-0.045em] '+focusClass}>scout<span className="text-lime">/</span>gaming</a>
          <span aria-hidden="true" className="hidden h-5 w-px bg-white/15 sm:block"/>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-white/50 sm:inline">{'// Spellobby'}</span>
        </div>
        <nav aria-label="Spelarkonto" className="flex flex-wrap items-center gap-x-5 text-xs text-white/65">
          {model.links.map(link=><a key={link.href} href={link.href} className={'inline-flex min-h-11 items-center hover:text-lime '+focusClass}>{link.label}</a>)}
          <a href="/" className={'inline-flex min-h-11 items-center hover:text-lime '+focusClass}>Till startsidan ↗</a>
        </nav>
      </div>
    </header>
    <div className="mx-auto max-w-[1480px] px-5 pb-14 sm:px-8 lg:px-10">
      <section className={'grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-end lg:gap-12 '+(scoped?'pb-7 pt-8 sm:pt-10':'pb-9 pt-10 sm:pt-14')}>
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-lime/40 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-lime"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_0_4px_rgba(214,255,58,.18)]"/>Scoutgaming / Spellobby</p>
          <h1 className={'font-medium tracking-[-0.045em] '+(scoped?'mt-5 text-4xl leading-[1.02] sm:text-5xl':'mt-6 text-[2.75rem] leading-[0.98] sm:text-6xl xl:text-7xl')}>Ditt bolag.{scoped?' ':<br/>}<span className="text-lime">Ditt bord.</span></h1>
          <p className={'max-w-xl leading-relaxed text-white/60 '+(scoped?'mt-4 text-base':'mt-5 text-base sm:text-lg')}>Välj spelbolag och hitta ditt spelrum. Där väljer du dealer och de miljöer som bolaget erbjuder.</p>
          <ul aria-label="Spel" className="mt-6 flex flex-wrap gap-2 text-xs">
            <li className="rounded-full bg-lime px-3.5 py-1.5 font-semibold text-ink">Blackjack</li>
            {model.pills.map(pill=><li key={pill.label} className="rounded-full border border-white/15 px-3.5 py-1.5 text-white/50">{pill.label} · {pill.status}</li>)}
          </ul>
        </div>
        <aside aria-label={model.fields.length?'Ditt spelkonto':'Om spellobbyn'} className={'rounded-3xl border border-white/10 bg-[#0f1113]/80 p-5 backdrop-blur sm:p-6 '+(scoped&&!model.fields.length?'hidden lg:block':'')}>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-lime"><span aria-hidden="true">{'// '}</span>{model.fields.length?'Ditt spelkonto':'Så fungerar det'}</p>
          <dl className="mt-3 divide-y divide-white/10 text-sm">
            {model.fields.length
              ?model.fields.map(field=><div key={field.label} className="flex flex-wrap justify-between gap-4 py-2.5"><dt className="text-white/50">{field.label}</dt><dd data-field={field.label} className="font-medium tabular-nums text-off">{field.value}</dd></div>)
              :facts.map(([label,value])=><div key={label} className="flex flex-wrap justify-between gap-4 py-2.5"><dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">{label}</dt><dd className="text-right text-white/80">{value}</dd></div>)}
          </dl>
          {model.sentence?<p className="mt-3 text-xs leading-relaxed text-white/50">{model.sentence}</p>:null}
          <p className="mt-4 rounded-full border border-white/15 px-3 py-1.5 text-center text-xs text-white/55">18+ · Demo utan riktiga pengar</p>
        </aside>
      </section>
      {model.notice?<p role="status" className="mb-6 rounded-2xl border border-amber-200/20 bg-amber-200/[.04] p-4 text-sm text-amber-100">{model.notice}</p>:null}
      <PlayerLobbyOperator initial={model.operator} playHref={model.primary?.href??'/play/blackjack'} playLabel={model.primary?.label??'Spela Blackjack'} directPlay={!model.primary?.href.startsWith('/player-login')}/>
      <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs leading-relaxed text-white/40">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-sm font-semibold tracking-[-0.045em] text-white/70">scout<span className="text-lime">/</span>gaming</span>
          <p>Utbud och miljöval bestäms av respektive spelbolag.</p>
        </div>
        <p>Administratör? <a href="/control/preview" className="text-white/65 underline underline-offset-4 hover:text-lime">Provspela i Sammansättning</a> med separat testsaldo.</p>
      </footer>
    </div>
  </main>;
}
