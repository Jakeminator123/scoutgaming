"use client";

import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CatalogueArtwork } from '@/components/catalogue-artwork';
import { DealerKeyFilter } from '@/components/dealer-key-filter';
import { LockedOverlay } from '@/components/locked-overlay';
import { STEP_IDS, scrollToSection, useLobby } from '@/components/lobby-provider';
import { pad, playUrlFor } from '@/lib/lobby-data';
import { cn } from '@/lib/utils';

export function DealersSection() {
  const { operator, room, dealer, dealers, selectDealer, status } = useLobby();
  const [open, setOpen] = useState(false);
  const locked = !room;
  const displayedDealers = operator ? dealers.filter(row => operator.dealerIds.includes(row.id)) : dealers;
  const placeholders = status === 'ready' ? Math.max(0, 4 - displayedDealers.length) : 0;
  const playUrl = operator && room && dealer ? playUrlFor({ operator, room, dealer }) : undefined;
  return <section id={STEP_IDS.dealer} className="relative scroll-mt-16 border-t border-border bg-background py-20 md:py-28">
    <DealerKeyFilter />
    <div className="px-5 md:px-10 lg:px-16">
      <div className="grid gap-8 border-b border-border pb-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7"><p className="eyebrow">{'// 03 — Dealer'}</p><h2 className="display mt-3 text-balance text-4xl text-off md:text-6xl">Möt din dealer.</h2></div>
        <p className="max-w-md leading-relaxed text-muted-foreground md:col-span-5 md:justify-self-end">{operator && room ? `Välj bland de dealers som är tillåtna i ${room.name} hos ${operator.name}. Du fortsätter med rummets publicerade inställningar.` : 'Dealers från den publicerade katalogen. Välj bolag och spelrum för att se vilka som är tillgängliga för dig.'}</p>
      </div>
      {room && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 animate-unlock"><div><p className="eyebrow">Ditt spelrum</p><p className="display mt-1 text-xl text-off">{room.name}</p><p className="mt-1 font-serif italic text-muted-foreground">{room.presentation}</p></div><button type="button" onClick={() => scrollToSection(STEP_IDS.room)} className="text-sm text-muted-foreground underline hover:text-off">Byt spelrum</button></div>}
      {displayedDealers.length + placeholders > 0 ? <div className="relative mt-10">
        <ul aria-label="Dealers" className={cn('grid grid-cols-2 gap-3 transition-opacity duration-500 motion-reduce:transition-none md:grid-cols-4 md:gap-4', locked && 'select-none opacity-60')}>
          {displayedDealers.map((catalogDealer, i) => {
            const permitted = room?.dealers.find(row => row.id === catalogDealer.id);
            const item = permitted ?? catalogDealer;
            const available = Boolean(room && permitted);
            const selected = dealer?.id === item.id;
            return <li key={item.id} className={cn(!locked && !available && 'opacity-50')}>
              <button type="button" aria-disabled={!available} aria-pressed={selected} aria-label={available ? `Välj ${item.name}` : `${item.name}, ${locked ? 'välj spelrum först' : 'inte tillgänglig i valt rum'}`} onClick={() => { if (!available) return; selectDealer(item.id); setOpen(true); }} className={cn('group w-full text-left focus-visible:outline-lime', !available && 'cursor-default')}>
                <div className={cn('relative overflow-hidden rounded-lg border transition-transform duration-500 motion-reduce:transition-none', selected ? 'border-lime' : 'border-border', available && 'group-hover:-translate-y-1 group-hover:border-lime')}>
                  <CatalogueArtwork name={item.name} dealerId={item.id} kind="dealer" selected={selected} fadeDelay={i * 70} className="aspect-[4/5]" />
                  <span className="pointer-events-none absolute left-3 top-3 z-30 font-mono text-[10px] uppercase text-off/70">Dealer {pad(i + 1)}</span>
                  {selected ? <span className="pointer-events-none absolute right-3 top-3 z-30 rounded-full bg-lime p-2 text-ink"><Check size={16} aria-label="Vald" /></span> : available && <span className="pointer-events-none absolute right-3 top-3 z-30 rounded-full bg-lime p-2 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><ArrowUpRight size={16} /></span>}
                </div>
                <h3 className="display mt-3 text-2xl text-off">{item.name}</h3><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{available ? `Tillgänglig i ${room?.name}` : locked ? 'Välj rum för att se tillgänglighet' : 'Ej i valt rum'}</p>
              </button>
            </li>;
          })}
          {Array.from({ length: placeholders }, (_, index) => <li key={`unpublished-${index}`} className="opacity-50">
            <div tabIndex={0} role="img" aria-label="Ej publicerad dealerplats. Designillustration, kan inte väljas." className="group rounded-lg text-left focus-visible:outline-lime">
              <div className="relative overflow-hidden rounded-lg border border-dashed border-border"><CatalogueArtwork name="" kind="dealer" className="aspect-[4/5]" />
                <span className="pointer-events-none absolute left-3 top-3 z-30 font-mono text-[10px] uppercase text-off/70">Ej publicerad</span>
              </div>
              <p className="display mt-3 text-2xl text-off">Ej publicerad</p><p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ingen dealer kopplad</p>
            </div>
          </li>)}
        </ul>
        {locked && displayedDealers.length > 0 && <div className="pointer-events-none [&_button]:pointer-events-auto"><LockedOverlay title={operator ? 'Välj spelrum för att möta din dealer' : 'Välj bolag först'} step={operator ? '02' : '01'} onClick={() => scrollToSection(operator ? STEP_IDS.room : STEP_IDS.operator)} /></div>}
        {displayedDealers.length === 0 && <p role="status" className="mt-5 text-sm text-muted-foreground">Inga dealers är publicerade för detta utbud ännu.</p>}
      </div> : <p role="status" className="mt-10 rounded-lg border border-dashed border-border p-6 text-muted-foreground">{status === 'loading' ? 'Hämtar publicerade dealers…' : status === 'error' ? 'Dealers kan inte visas just nu.' : 'Inga dealers är publicerade för detta utbud ännu.'}</p>}
    </div>
    <Dialog open={open && Boolean(operator && room && dealer)} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-2rem)] overflow-y-auto border-border bg-card p-0 sm:max-w-3xl">
        {operator && room && dealer && <div className="grid md:grid-cols-2">
          <CatalogueArtwork name={dealer.name} dealerId={dealer.id} kind="dealer" selected className="aspect-square md:aspect-auto md:min-h-96" />
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
