"use client";

import { ArrowRight, Check } from 'lucide-react';
import { CatalogueArtwork } from '@/components/catalogue-artwork';
import { STEP_IDS, scrollToSection, useLobby } from '@/components/lobby-provider';
import { genitive, pad } from '@/lib/lobby-data';
import { cn } from '@/lib/utils';

export function RoomsSection() {
  const { operator, room, availableRooms, selectRoom } = useLobby();
  return <section id={STEP_IDS.room} className="relative scroll-mt-16 border-t border-border bg-background py-20 md:py-28">
    <div className="px-5 md:px-10 lg:px-16">
      <div className="grid gap-8 border-b border-border pb-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7"><p className="eyebrow">{'// 02 — Spelrum'}</p>
          <h2 className="display mt-3 text-balance text-4xl text-off md:text-6xl">{operator ? `${genitive(operator.name)} rum.` : 'Välj ditt spelrum.'}</h2>
        </div><p className="max-w-md leading-relaxed text-muted-foreground md:col-span-5 md:justify-self-end">{operator ? 'Välj bland bolagets publicerade rum. Varje rum har sitt eget spel och sina tillåtna dealers.' : 'Välj ett bolag först för att visa tillgängliga spelrum.'}</p>
      </div>
      {!operator ? <button type="button" onClick={() => scrollToSection(STEP_IDS.operator)} className="mt-8 rounded-full border border-border px-5 py-2 text-sm text-off">Välj bolag först</button>
        : !availableRooms.length ? <p role="status" className="mt-10 text-muted-foreground">Inga publicerade rum är tillgängliga hos {operator.name}.</p>
        : <ul aria-label="Spelrum" className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {availableRooms.map((item, i) => <li key={item.key}>
            <button type="button" aria-pressed={room?.key === item.key} onClick={() => selectRoom(item.key)}
              className={cn('group w-full overflow-hidden rounded-lg border bg-card text-left transition-transform hover:-translate-y-1 focus-visible:outline-lime', room?.key === item.key ? 'border-lime' : 'border-border hover:border-lime')}>
              <div className="relative"><CatalogueArtwork kind="room" name={item.name} className="h-60" />
                <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Rum {pad(i + 1)}</span>
                {room?.key === item.key && <span className="absolute right-4 top-4 rounded-full bg-lime p-2 text-ink"><Check size={16} aria-label="Valt" /></span>}
              </div>
              <div className="p-5"><h3 className="display text-2xl text-off">{item.name}</h3><p className="mt-1 font-serif text-lg italic text-muted-foreground">{item.presentation}</p>
                <p className="mt-4 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{item.game === 'roulette' ? 'Roulette' : 'Blackjack'} · {item.dealers.length} dealers</p>
              </div>
            </button>
          </li>)}
        </ul>}
      {room && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">Valt: <span className="text-off">{room.name}</span></p>
        <button type="button" onClick={() => scrollToSection(STEP_IDS.dealer)} className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink">Fortsätt till dealer<ArrowRight size={16} /></button>
      </div>}
    </div>
  </section>;
}
