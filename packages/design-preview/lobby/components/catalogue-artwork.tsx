import { cn } from '@/lib/utils';

/** Neutral artwork: never associate a template photograph with a registered person or room. */
export function CatalogueArtwork({ name, kind, className }: { name: string; kind: 'room' | 'dealer'; className?: string }) {
  return <div aria-hidden className={cn('relative flex items-center justify-center overflow-hidden bg-secondary text-brass', className)}
    style={{ backgroundImage: 'radial-gradient(ellipse at 30% 10%, #b49a5633, transparent 70%)' }}>
    <span className="absolute inset-5 rounded-full border border-brass/20" />
    <span className="absolute inset-10 rounded-full border border-brass/10" />
    <span className="font-serif text-7xl opacity-70 md:text-8xl">{kind === 'dealer' ? Array.from(name)[0] : '♠'}</span>
    <span className="absolute bottom-3 inset-x-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
      {kind === 'dealer' ? 'Porträtt ej kopplat' : 'Rumsbild ej kopplad'}
    </span>
  </div>;
}
