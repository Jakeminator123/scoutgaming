"use client";

import { ArrowRight, Check } from 'lucide-react';
import { CatalogueArtwork } from '@/components/catalogue-artwork';
import { LockedOverlay } from '@/components/locked-overlay';
import { STEP_IDS, scrollToSection, useLobby } from '@/components/lobby-provider';
import { genitive, pad } from '@/lib/lobby-data';
import { cn } from '@/lib/utils';

export function RoomsSection() {
  const { operator, room, rooms, operators, availableRooms, selectRoom, status } = useLobby();
  const locked = !operator;
  const displayedRooms = operator ? availableRooms : rooms;
  return <section id={STEP_IDS.room} className="relative scroll-mt-16 border-t border-border bg-background py-20 md:py-28">
    <div className="px-5 md:px-10 lg:px-16">
      <div className="grid gap-8 border-b border-border pb-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7"><p className="eyebrow">{'// 02 — Spelbord'}</p>
          <h2 className="display mt-3 text-balance text-4xl text-off md:text-6xl">{operator ? `${genitive(operator.name)} spelbord.` : 'Hitta ditt spelbord.'}</h2>
        </div><p className="max-w-md leading-relaxed text-muted-foreground md:col-span-5 md:justify-self-end">{operator ? 'Här visas spelbordens spel och publicerade miljö. Välj ditt spelbord och sedan en av dess dealers.' : 'En förhandstitt på publicerade spelbord. Välj ditt bolag för att låsa upp dess spelbord.'}</p>
      </div>
      {displayedRooms.length ? <div className="relative mt-10">
        <ul aria-label="Spelbord" className={cn('grid auto-rows-[260px] grid-cols-1 gap-3 transition-[opacity,filter] duration-500 motion-reduce:transition-none md:grid-cols-4 md:auto-rows-[220px]', locked && 'select-none opacity-40 grayscale blur-[1px]')}>
          {displayedRooms.map((item, i) => {
            const selected = room?.key === item.key;
            const companyName = operators.find(row => row.id === item.operatorId)?.name;
            return <li key={item.key} className={cn('[perspective:1400px]', displayedRooms.length === 2
              ? i === 0 ? 'md:col-span-3 md:row-span-2' : 'md:col-span-1 md:row-span-2'
              : i % 3 === 0 ? 'md:col-span-2 md:row-span-2' : 'md:col-span-2 md:row-span-1')}>
              <button type="button" disabled={locked} aria-pressed={selected} onClick={() => selectRoom(item.key)}
                className={cn('group relative h-full w-full overflow-hidden rounded-lg border bg-card text-left transition-[transform,border-color] duration-500 motion-reduce:transition-none focus-visible:outline-lime', selected ? 'border-lime' : 'border-border', !locked && 'hover:-translate-y-1 hover:border-lime')}>
                <CatalogueArtwork kind="room" name={item.name} image={item.image} illustration={item.illustration} game={item.game} selected={selected} fadeDelay={i * 80} className="absolute inset-0 h-full w-full" />
                <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-wider text-off/80">Bord {pad(i + 1)}</span>
                  {selected ? <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2 py-1 text-xs text-ink"><Check size={13} />Valt</span> : <span className="rounded-full border border-off/30 bg-ink/40 px-2 py-1 font-mono text-[9px] uppercase text-off/80">{locked ? companyName ?? 'Välj bolag' : item.preparing ? 'Förbereds' : 'Publicerat'}</span>}
                </div>
                <div className="absolute inset-x-5 bottom-10"><h3 className="display break-words text-2xl text-off md:text-3xl">{item.name}</h3><p className="mt-1 font-serif text-lg italic text-off/80">{item.environmentLabel ?? item.presentation}</p>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-off/70">{item.game === 'roulette' ? 'Roulette' : 'Blackjack'} · {item.dealers.length} dealers</p>
                </div>
              </button>
            </li>;
          })}
        </ul>
        {locked && <LockedOverlay title="Välj bolag för att öppna spelborden" step="01" onClick={() => scrollToSection(STEP_IDS.operator)} />}
      </div> : <p role="status" className="mt-10 rounded-lg border border-dashed border-border p-6 text-muted-foreground">{status === 'loading' ? 'Hämtar publicerade spelbord…' : status === 'error' ? 'Spelborden kan inte visas just nu.' : operator ? `Inga publicerade spelbord är tillgängliga hos ${operator.name}.` : 'Inga publicerade spelbord är tillgängliga ännu.'}</p>}
      {room && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 animate-unlock">
        <p className="text-sm text-muted-foreground">Valt: <span className="text-off">{room.name}</span></p>
        <button type="button" onClick={() => scrollToSection(STEP_IDS.dealer)} className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink">Fortsätt till dealer<ArrowRight size={16} /></button>
      </div>}
    </div>
  </section>;
}
