"use client";

import { ArrowRight, Check, RefreshCw } from 'lucide-react';
import { STEP_IDS, scrollToSection, useLobby } from '@/components/lobby-provider';
import { pad } from '@/lib/lobby-data';
import { cn } from '@/lib/utils';

export function OperatorsSection() {
  const { operators, operator, selectOperator, availableRooms, status, error, reload } = useLobby();
  return <section id={STEP_IDS.operator} className="relative scroll-mt-16 border-t border-border bg-background py-20 md:py-28">
    <div className="px-5 md:px-10 lg:px-16">
      <div className="grid gap-8 border-b border-border pb-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7"><p className="eyebrow">{'// 01 — Bolag'}</p>
          <h2 className="display mt-3 text-balance text-4xl text-off md:text-6xl">Vilket bolag <span className="font-serif font-medium italic text-muted-foreground">spelar du hos?</span></h2>
        </div>
        <p className="max-w-md leading-relaxed text-muted-foreground md:col-span-5 md:justify-self-end">Välj ett registrerat spelbolag. Här visas de spelbord och dealers som är publicerade för just det bolaget.</p>
      </div>
      {status === 'loading' && <p role="status" className="mt-10 text-muted-foreground">Hämtar spelbolag och publicerade spelbord…</p>}
      {status === 'error' && <div role="alert" className="mt-10 rounded-lg border border-border bg-card p-6">
        <p className="text-off">{error}</p><button type="button" onClick={reload} className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-off"><RefreshCw size={14} />Försök igen</button>
        <a href="/admin/structure" className="ml-4 text-sm text-muted-foreground underline">Till administrationen</a>
      </div>}
      {status === 'ready' && !operators.length && <p role="status" className="mt-10 rounded-lg border border-dashed border-border p-6 text-muted-foreground">Inga spelbolag är tillgängliga i den publicerade katalogen ännu.</p>}
      {status === 'ready' && operators.length > 0 && <ul aria-label="Spelbolag" className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {operators.map((op, i) => <li key={op.id} className="[perspective:1200px]">
          <button type="button" aria-pressed={operator?.id === op.id} onClick={() => selectOperator(op.id)}
            className={cn('group relative flex aspect-[3/4] w-full origin-left flex-col justify-between overflow-hidden rounded-lg border bg-card p-4 text-left transition-[transform,border-color,opacity] duration-500 hover:border-lime focus-visible:outline-lime',
              operator?.id === op.id ? 'border-lime' : 'border-border hover:[transform:rotateY(-6deg)_translateY(-4px)]', operator && operator.id !== op.id && 'opacity-60 hover:opacity-100')}>
            <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-lime" />
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-muted-foreground">{pad(i + 1)}</span>
              {operator?.id === op.id ? <Check className="h-4 w-4 text-lime" aria-label="Valt" /> : <span className="font-mono text-[9px] uppercase text-muted-foreground">{op.roomIds.length ? 'Publicerat' : 'Inga spelbord'}</span>}
            </div>
            <span className="display text-6xl leading-none text-lime md:text-7xl" aria-hidden>{op.monogram}</span>
            <div><p className="display break-words text-lg text-off md:text-xl">{op.name}</p>
              <p className="mt-1 font-serif text-base italic text-muted-foreground">{op.id}</p>
              <p className="mt-3 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{op.roomIds.length} spelbord · {op.dealerIds.length} dealers</p>
            </div>
          </button>
        </li>)}
      </ul>}
      {operator && <div className="mt-8 grid gap-8 rounded-lg border border-border bg-card p-5 animate-unlock md:grid-cols-2 md:p-7">
        <div><p className="eyebrow">Du har valt</p><h3 className="display mt-2 text-3xl text-off md:text-5xl">{operator.name}</h3>
          <p className="mt-4 text-muted-foreground">{availableRooms.length ? `${availableRooms.length} publicerade spelbord. Välj ett spelbord för att se dess tillåtna dealers.` : 'Bolaget har inga publicerade spelbord tillgängliga just nu.'}</p>
        </div>
        <div><ul className="flex flex-wrap gap-2">{availableRooms.map(room => <li key={room.key} className="rounded-md border border-border px-3 py-2 text-sm text-off">{room.name}</li>)}</ul>
          {availableRooms.length > 0 && <button type="button" onClick={() => scrollToSection(STEP_IDS.room)} className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink">Fortsätt till spelbord<ArrowRight className="h-4 w-4" /></button>}
        </div>
      </div>}
    </div>
  </section>;
}
