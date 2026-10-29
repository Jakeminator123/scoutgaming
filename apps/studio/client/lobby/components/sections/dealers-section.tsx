"use client";
import { RoomChoices } from '../room-choices';

import { useRef, useState } from 'react';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CatalogueArtwork } from '@/components/catalogue-artwork';
import { DealerPortrait } from '@/components/dealer-portrait';
import { LockedOverlay } from '@/components/locked-overlay';
import { STEP_IDS, scrollToSection, useLobby } from '@/components/lobby-provider';
import { dealerCards, portraitFor, portraitBackdrop } from '@/lib/dealer-portraits.mjs';
import { pad, playUrlFor, type Dealer } from '@/lib/lobby-data';
import { cn } from '@/lib/utils';

function DealerArtwork({ dealer, selected = false, available = false, detail = false }: {
  dealer: Dealer; selected?: boolean; available?: boolean; detail?: boolean;
}) {
  const portrait = portraitFor(dealer);
  if (!portrait) return <CatalogueArtwork name={dealer.name} kind="dealer" className="aspect-square" />;
  return <DealerPortrait
    dealer={portrait}
    backdrop={portraitBackdrop}
    interactive={available && !detail}
    painted={selected || detail}
    colored={selected || detail}
    playOnMount={detail}
    alt={detail ? `Porträtt av ${dealer.name}` : ''}
    sizes={detail ? '(min-width: 768px) 384px, 100vw' : '(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw'}
    className="aspect-square"
  />;
}

export function DealersSection() {
  const { operator, room, dealer, availableDealers, selectDealer, status, prepareLaunch } = useLobby();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const locked = status !== 'ready' || !operator || !room;
  const cards = dealerCards(locked ? [] : availableDealers);
  const selectionKey = operator && room && dealer ? `${room.key}:${dealer.id}` : null;
  const playUrl = operator && room && dealer ? playUrlFor({ operator, room, dealer }) : undefined;

  return <section id={STEP_IDS.dealer} className="relative scroll-mt-16 border-t border-border bg-background py-20 md:py-28">
    <div className="px-5 md:px-10 lg:px-16">
      <div className="grid gap-8 border-b border-border pb-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <p className="eyebrow">{'// 03 — Dealer'}</p>
          <h2 className="display mt-3 text-balance text-4xl text-off md:text-6xl">{locked ? <>Möt din nästa <span className="font-serif font-medium italic text-muted-foreground">dealer.</span></> : 'Välj din dealer'}</h2>
        </div>
        <p className="max-w-md leading-relaxed text-muted-foreground md:col-span-5 md:justify-self-end">{!locked
          ? `Välj bland publicerade dealers i ${room.name} hos ${operator.name}. Klicka på ett porträtt för att öppna bordet.`
          : 'En förhandstitt på våra dealers. Välj bolag och spelbord för att låsa upp de porträtt som ingår.'}</p>
      </div>
      {!locked && <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-5 py-4">
        <p className="text-sm text-off">{room.name} <span className="text-muted-foreground">hos {operator.name}</span></p>
        <button type="button" onClick={() => scrollToSection(STEP_IDS.room)} className="text-sm text-lime underline-offset-4 hover:underline">Byt spelbord</button>
      </div>}
      <div className="relative mt-8">
        <ul aria-label="Dealers" aria-hidden={locked} className={cn(
          'grid grid-cols-2 gap-3 transition-[opacity,filter] duration-500 motion-reduce:transition-none md:grid-cols-3 md:gap-4 xl:grid-cols-5',
          locked && 'pointer-events-none select-none opacity-40 blur-[2px]',
        )}>
          {cards.map((item, i) => {
            const available = !locked && item.available;
            const selected = available && dealer?.id === item.id;
            return <li key={item.id}>
              <button type="button" disabled={!available} aria-pressed={selected}
                aria-label={available ? `Välj ${item.name}` : `${item.name} – inte tillgänglig vid valt spelbord`}
                onClick={event => {
                  if (!available || !room) return;
                  dialogTrigger.current = event.currentTarget;
                  selectDealer(item.id);
                  setOpenFor(`${room.key}:${item.id}`);
                }}
                className={cn('group w-full text-left focus-visible:outline-lime', !available && 'cursor-not-allowed')}>
                <div className={cn('relative overflow-hidden rounded-lg border transition-[border-color,transform] motion-reduce:transition-none',
                  selected ? 'border-lime' : 'border-border', available && 'group-hover:-translate-y-1 group-hover:border-lime',
                  !available && !locked && 'opacity-50 grayscale')}>
                  <DealerArtwork dealer={item} available={available} selected={selected} />
                  <span className="absolute left-3 top-3 rounded-sm bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase text-off">Dealer {pad(i + 1)}</span>
                  {selected ? <span className="absolute right-3 top-3 rounded-full bg-lime p-2 text-ink"><Check size={16} aria-label="Vald" /></span>
                    : !available && !locked ? <span className="absolute right-3 top-3 rounded-full bg-ink/80 p-2 text-off"><Lock size={16} aria-hidden /></span> : null}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-4 pb-4 pt-12">
                    <h3 className="display text-2xl text-off md:text-3xl">{item.name}</h3>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-off/70">{locked ? 'Dealer' : available ? 'Tillgänglig vid ditt spelbord' : 'Ej vid detta spelbord'}</p>
                  </div>
                </div>
              </button>
            </li>;
          })}
        </ul>
        {locked && <LockedOverlay title={operator ? 'Välj spelbord först' : 'Välj bolag först'} step={operator ? '02' : '01'} onClick={() => scrollToSection(operator ? STEP_IDS.room : STEP_IDS.operator)} />}
      </div>
      {dealer && openFor !== selectionKey && <div className="max-w-md"><RoomChoices /></div>}
    </div>
    <Dialog open={!locked && openFor !== null && openFor === selectionKey} onOpenChange={value => { if (!value) setOpenFor(null); }}>
      <DialogContent onCloseAutoFocus={event => {
        const trigger = dialogTrigger.current;
        dialogTrigger.current = null;
        if (trigger?.isConnected && !trigger.disabled) {
          event.preventDefault();
          trigger.focus();
        }
      }} className="max-h-[92vh] max-w-[calc(100%-2rem)] overflow-y-auto border-border bg-card p-0 sm:max-w-3xl">
        {operator && room && dealer && <div className="grid md:grid-cols-2">
          <DealerArtwork key={selectionKey} dealer={dealer} detail />
          <div className="flex flex-col p-6 md:p-8">
            <DialogHeader className="text-left"><p className="eyebrow">Ditt val</p><DialogTitle className="display text-4xl text-off">{dealer.name}</DialogTitle><DialogDescription className="mt-2 font-serif text-xl italic">{room.name} hos {operator.name}</DialogDescription></DialogHeader>
            <dl className="mt-6 grid gap-4 border-y border-border py-5"><div><dt className="eyebrow">Spel</dt><dd className="mt-1 text-off">{room.game === 'roulette' ? 'Roulette' : 'Blackjack'}</dd></div></dl>
            <RoomChoices />
            <p className="mt-5 text-sm text-muted-foreground">Du kan behöva logga in som spelare när bordet öppnas.</p>
            {playUrl && <a href={playUrl} onClick={prepareLaunch} onAuxClick={prepareLaunch} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink">Spela med {dealer.name}<ArrowRight size={16} aria-hidden /></a>}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </section>;
}
