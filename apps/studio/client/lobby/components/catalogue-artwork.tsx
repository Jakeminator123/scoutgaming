import { useState } from 'react';
import { FadeImage } from '@/components/fade-image';
import type { RoomIllustration } from '@/lib/catalog.mjs';
import { cn } from '@/lib/utils';

type ArtworkProps = {
  name: string; kind: 'room' | 'dealer'; image?: string; backdrop?: string; illustration?: RoomIllustration;
  game?: 'blackjack' | 'roulette'; className?: string; selected?: boolean; fadeDelay?: number;
};

/** Public room imagery; dealer fallback stays neutral beside the verified portraits.
 * Without a published background a room shows its bet profile's illustration (catalog.mjs, roomIllustration). */
export function CatalogueArtwork({ name, kind, image, illustration, game = 'blackjack', className, selected = false, fadeDelay = 0 }: ArtworkProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (kind === 'dealer') return <div aria-hidden className={cn('relative flex items-center justify-center overflow-hidden bg-secondary text-brass', className)}
    style={{ backgroundImage: 'radial-gradient(ellipse at 30% 10%, #b49a5633, transparent 70%)' }}>
    <span className="absolute inset-5 rounded-full border border-brass/20" /><span className="absolute inset-10 rounded-full border border-brass/10" />
    {/* The card's name and status cover the bottom edge, so the label sits under the initial. */}
    <span className="relative flex flex-col items-center gap-2">
      <span className="font-serif text-7xl opacity-70 md:text-8xl">{Array.from(name)[0]}</span>
      <span className="hidden text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground md:block">Porträtt ej kopplat</span>
    </span>
  </div>;
  const actualImage = image && image !== failedSource ? image : undefined;
  const picture = actualImage ? { image: actualImage, alt: '' } : illustration;
  return <div className={cn('relative overflow-hidden bg-secondary text-brass', className)}>
    {picture && <div className={cn('absolute inset-0 transition-[opacity,transform] duration-700 motion-reduce:transition-none',
      selected ? 'opacity-100 scale-105' : 'opacity-60 group-hover:opacity-100 group-focus-visible:opacity-100 group-hover:scale-105')}>
      <FadeImage key={picture.image} src={picture.image} alt={picture.alt} fill sizes="(min-width: 768px) 50vw, 100vw" fadeDelay={fadeDelay}
        onError={() => { if (actualImage) setFailedSource(actualImage); }} className="object-cover" />
    </div>}
    {game === 'roulette' && !actualImage && <div aria-hidden className="absolute inset-0 flex items-center justify-center bg-ink/50"><svg viewBox="0 0 160 160" className="h-40 w-40 text-brass/80"><circle cx="80" cy="80" r="68" fill="#141713" stroke="currentColor" strokeWidth="8" /><circle cx="80" cy="80" r="49" fill="none" stroke="currentColor" strokeWidth="20" strokeDasharray="8 5" /><circle cx="80" cy="80" r="24" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M80 55v50M55 80h50" stroke="currentColor" strokeWidth="5" /></svg></div>}
    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-transparent to-ink/15" />
    {!actualImage && <span className="absolute inset-x-3 bottom-3 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-off/75">Designillustration</span>}
  </div>;
}
