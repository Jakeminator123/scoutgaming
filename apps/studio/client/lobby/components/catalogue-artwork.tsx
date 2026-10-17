import { useState } from 'react';
import { FadeImage } from '@/components/fade-image';
import { cn } from '@/lib/utils';

type ArtworkProps = {
  name: string; kind: 'room' | 'dealer'; image?: string; backdrop?: string;
  game?: 'blackjack' | 'roulette'; className?: string; selected?: boolean; fadeDelay?: number;
};

/** Public room imagery; dealer fallback stays neutral beside the verified portraits. */
export function CatalogueArtwork({ name, kind, image, game = 'blackjack', className, selected = false, fadeDelay = 0 }: ArtworkProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (kind === 'dealer') return <div aria-hidden className={cn('relative flex items-center justify-center overflow-hidden bg-secondary text-brass', className)}
    style={{ backgroundImage: 'radial-gradient(ellipse at 30% 10%, #b49a5633, transparent 70%)' }}>
    <span className="absolute inset-5 rounded-full border border-brass/20" /><span className="absolute inset-10 rounded-full border border-brass/10" />
    <span className="font-serif text-7xl opacity-70 md:text-8xl">{Array.from(name)[0]}</span>
    <span className="absolute bottom-3 inset-x-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Porträtt ej kopplat</span>
  </div>;
  const actualImage = image && image !== failedSource ? image : undefined;
  const illustration = '/admin/_assets/lobby/images/lobby/room-salongen.png';
  return <div className={cn('relative overflow-hidden bg-secondary text-brass', className)}>
    <div className={cn('absolute inset-0 transition-[opacity,transform] duration-700 motion-reduce:transition-none',
      selected ? 'opacity-100 scale-105' : 'opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:scale-105')}>
      <FadeImage src={actualImage ?? illustration} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" fadeDelay={fadeDelay}
        onError={() => { if (actualImage) setFailedSource(actualImage); }} className="object-cover" />
    </div>
    {game === 'roulette' && !actualImage && <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-ink/50"><svg viewBox="0 0 160 160" className="h-40 w-40 text-brass/80"><circle cx="80" cy="80" r="68" fill="#141713" stroke="currentColor" strokeWidth="8" /><circle cx="80" cy="80" r="49" fill="none" stroke="currentColor" strokeWidth="20" strokeDasharray="8 5" /><circle cx="80" cy="80" r="24" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M80 55v50M55 80h50" stroke="currentColor" strokeWidth="5" /></svg></div>}
    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-ink/15" />
    {!actualImage && <span className="absolute inset-x-3 bottom-3 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-off/75">Designillustration</span>}
  </div>;
}
