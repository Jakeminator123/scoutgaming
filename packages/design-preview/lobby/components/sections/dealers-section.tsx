"use client";

import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CatalogueArtwork } from '@/components/catalogue-artwork';
import { STEP_IDS, scrollToSection, useLobby } from '@/components/lobby-provider';
import { pad, playUrlFor } from '@/lib/lobby-data';
import { cn } from '@/lib/utils';

export function DealersSection() {
  const { operator, room, dealer, availableDealers, selectDealer } = useLobby();
  const [open, setOpen] = useState(false);
  const playUrl = operator && room && dealer ? playUrlFor({ operator, room, dealer }) : undefined;
  return <section id={STEP_IDS.dealer} className="relative scroll-mt-16 border-t border-border bg-background py-20 md:py-28">
    <div className="px-5 md:px-10 lg:px-16">
      <div className="grid gap-8 border-b border-border pb-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7"><p className="eyebrow">{'// 03 — Dealer'}</p><h2 className="display mt-3 text-balance text-4xl text-off md:text-6xl">Välj din dealer</h2></div>
        <p className="max-w-md leading-relaxed text-muted-foreground md:col-span-5 md:justify-self-end">{operator && room ? `Publicerade för ${room.name} hos ${operator.name}. Ditt val kontrolleras igen när spelet öppnas.` : 'Välj bolag och spelrum för att se vilka dealers som är tillåtna.'}</p>
      </div>
      {!room ? <button type="button" onClick={() => scrollToSection(operator ? STEP_IDS.room : STEP_IDS.operator)} className="mt-8 rounded-full border border-border px-5 py-2 text-sm text-off">{operator ? 'Välj spelrum först' : 'Välj bolag först'}</button>
        : <ul aria-label="Dealers" className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {availableDealers.map((item, i) => <li key={item.id}>
            <button type="button" aria-pressed={dealer?.id === item.id} aria-label={`Välj ${item.name}`} onClick={() => { selectDealer(item.id); setOpen(true); }} className="group w-full text-left focus-visible:outline-lime">
              <div className={cn('relative overflow-hidden rounded-lg border transition-transform group-hover:-translate-y-1', dealer?.id === item.id ? 'border-lime' : 'border-border group-hover:border-lime')}>
                <CatalogueArtwork name={item.name} kind="dealer" className="aspect-square" />
                <span className="absolute left-3 top-3 font-mono text-[10px] uppercase text-muted-foreground">Dealer {pad(i + 1)}</span>
                {dealer?.id === item.id && <span className="absolute right-3 top-3 rounded-full bg-lime p-2 text-ink"><Check size={16} aria-label="Vald" /></span>}
              </div>
              <h3 className="display mt-3 text-2xl text-off">{item.name}</h3><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Tillgänglig i {room.name}</p>
            </button>
          </li>)}
        </ul>}
    </div>
    <Dialog open={open && Boolean(operator && room && dealer)} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-2rem)] overflow-y-auto border-border bg-card p-0 sm:max-w-3xl">
        {operator && room && dealer && <div className="grid md:grid-cols-2">
          <CatalogueArtwork name={dealer.name} kind="dealer" className="aspect-square md:aspect-auto md:min-h-96" />
          <div className="flex flex-col p-6 md:p-8"><DialogHeader className="text-left"><p className="eyebrow">Ditt val</p><DialogTitle className="display text-4xl text-off">{dealer.name}</DialogTitle><DialogDescription className="mt-2 font-serif text-xl italic">{room.name} hos {operator.name}</DialogDescription></DialogHeader>
            <dl className="mt-6 grid gap-4 border-y border-border py-5"><div><dt className="eyebrow">Spel</dt><dd className="mt-1 text-off">{room.game === 'roulette' ? 'Roulette' : 'Blackjack'}</dd></div><div><dt className="eyebrow">Sammansättning</dt><dd className="mt-1 text-off">{room.presentation}</dd></div></dl>
            <p className="mt-5 text-sm text-muted-foreground">Spelet öppnas i den befintliga spelvyn. Du kan behöva logga in som spelare.</p>
            {playUrl && <a href={playUrl} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink">Spela med {dealer.name}<ArrowRight size={16} /></a>}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
