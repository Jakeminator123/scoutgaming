import { useState } from 'react';
import { FadeImage } from '@/components/fade-image';
import { DealerPortrait, type ApprovedDealerVideo } from '@/components/dealer-portrait';
import { suppliedDealerArtwork } from '@/lib/dealer-artwork.mjs';
import { cn } from '@/lib/utils';

type ArtworkProps = {
  name: string; kind: 'room' | 'dealer'; dealerId?: string; image?: string; backdrop?: string;
  approvedVideo?: ApprovedDealerVideo;
  game?: 'blackjack' | 'roulette'; className?: string; selected?: boolean; fadeDelay?: number;
};

/** Supplied portraits are attached to verified identities; they never grant room/dealer access. */
export function CatalogueArtwork({ name, kind, dealerId, image, approvedVideo, backdrop, game = 'blackjack', className, selected = false, fadeDelay = 0 }: ArtworkProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const supplied = kind === 'dealer' && dealerId ? suppliedDealerArtwork({ id: dealerId, name }) : undefined;
  if (kind === 'dealer') return <DealerPortrait name={name} image={supplied?.image ?? image} approvedVideo={supplied?.approvedVideo ?? approvedVideo} backdrop={backdrop} selected={selected} fadeDelay={fadeDelay} className={className} />;
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
