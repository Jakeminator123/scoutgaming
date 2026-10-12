"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { FadeImage } from '@/components/fade-image';
import { DEALER_KEY_FILTER_ID } from '@/components/dealer-key-filter';
import { cn } from '@/lib/utils';

/** Future callers must receive this approval from the published catalogue. No donor clip is inferred. */
export type ApprovedDealerVideo = { src: string; approved: true; source: 'published-catalogue' };
type DealerPortraitProps = {
  name: string; image?: string; approvedVideo?: ApprovedDealerVideo; backdrop?: string;
  selected?: boolean; className?: string; fadeDelay?: number;
};

function Silhouette({ className }: { className?: string }) {
  return <svg viewBox="0 0 240 280" aria-hidden className={cn('absolute inset-0 h-full w-full text-brass', className)}>
    <ellipse cx="120" cy="105" rx="39" ry="48" fill="currentColor" opacity=".7" />
    <path d="M24 280v-33c0-45 36-83 77-88l19 29 19-29c41 5 77 43 77 88v33Z" fill="currentColor" opacity=".65" />
    <path d="m102 165 18 22 18-22-7 70h-22Z" fill="#181b17" opacity=".8" />
    <path d="m120 184 9 14-9 40-9-40Z" fill="#c6d99c" opacity=".7" />
  </svg>;
}

/** Grayscale studio sheet -> circular colour/environment reveal from the actual pointer. */
export function DealerPortrait({ name, image, approvedVideo, backdrop, selected = false, className, fadeDelay = 0 }: DealerPortraitProps) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [failedBackdrop, setFailedBackdrop] = useState<string | null>(null);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  // Keep video dormant until the visitor's preference has been read on mount.
  const [reducedMotion, setReducedMotion] = useState(true);
  const actualImage = image && image !== failedImage ? image : undefined;
  const actualBackdrop = backdrop && backdrop !== failedBackdrop ? backdrop : undefined;
  const videoSource = approvedVideo?.approved === true && approvedVideo.source === 'published-catalogue'
    && approvedVideo.src !== failedVideo ? approvedVideo.src : undefined;
  const revealed = hovered || focused || selected;
  const revealStyle = {
    '--reveal-x': '50%', '--reveal-y': '50%',
  } as CSSProperties;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => { media.removeEventListener('change', update); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, []);

  // React focus events on the containing button do not traverse this child. Observe its focus state directly.
  useEffect(() => {
    const owner = root.current?.closest('button, [tabindex]');
    if (!owner) return;
    const focus = () => { setFocused(true); root.current?.style.setProperty('--reveal-x', '50%'); root.current?.style.setProperty('--reveal-y', '50%'); };
    const blur = () => setFocused(false);
    owner.addEventListener('focus', focus); owner.addEventListener('blur', blur);
    if (owner === document.activeElement) focus();
    return () => { owner.removeEventListener('focus', focus); owner.removeEventListener('blur', blur); };
  }, []);

  useEffect(() => {
    const node = video.current;
    if (!node || !videoSource) return;
    let disposed = false;
    const sync = () => {
      if (revealed && !reducedMotion && !document.hidden) {
        node.play().catch(() => { if (!disposed) { setFailedVideo(videoSource); setVideoPlaying(false); } });
      } else { node.pause(); setVideoPlaying(false); }
    };
    sync(); document.addEventListener('visibilitychange', sync);
    return () => { disposed = true; node.pause(); document.removeEventListener('visibilitychange', sync); };
  }, [revealed, reducedMotion, videoSource]);

  const trackPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      root.current?.style.setProperty('--reveal-x', `${x}%`);
      root.current?.style.setProperty('--reveal-y', `${y}%`);
    });
  };

  return <div ref={root} style={revealStyle} data-dealer-reveal={revealed ? 'open' : 'closed'}
    onPointerEnter={event => { trackPointer(event); setHovered(true); }} onPointerMove={trackPointer} onPointerLeave={() => setHovered(false)}
    className={cn('relative overflow-hidden bg-[#f6f5f1]', className)}>
    <div aria-hidden className="absolute inset-0 z-10 bg-[#f6f5f1] grayscale transition-[clip-path] duration-700 ease-out motion-reduce:transition-none"
      style={{ clipPath: `circle(${revealed ? '0%' : '150%'} at var(--reveal-x) var(--reveal-y))` }}>
      {actualImage ? <div className="absolute -inset-1" style={{ filter: `url(#${DEALER_KEY_FILTER_ID})` }}><FadeImage src={actualImage} alt="" fill fadeDelay={fadeDelay} sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" onError={() => setFailedImage(actualImage)} /></div> : <Silhouette className="text-[#777c72]" />}
    </div>
    <div aria-hidden className="absolute inset-0">
      {actualBackdrop ? <FadeImage src={actualBackdrop} alt="" fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" onError={() => setFailedBackdrop(actualBackdrop)} />
        : <div className="absolute inset-0 bg-ink" style={{ backgroundImage: 'radial-gradient(ellipse at 30% 10%, #b49a5670, transparent 70%)' }} />}
      <div className={cn('absolute inset-0 transition-transform duration-500 motion-reduce:transition-none', revealed && 'scale-[1.03]')}>
        {actualImage ? <div className="absolute -inset-1" style={{ filter: `url(#${DEALER_KEY_FILTER_ID})` }}><FadeImage src={actualImage} alt="" fill fadeDelay={fadeDelay} sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" onError={() => setFailedImage(actualImage)} /></div> : <Silhouette />}
        {videoSource && !reducedMotion && <div className="absolute -inset-1" style={{ filter: `url(#${DEALER_KEY_FILTER_ID})` }}><video ref={video} src={videoSource} muted playsInline preload="none" aria-hidden
          onPlaying={() => setVideoPlaying(true)} onEnded={() => setVideoPlaying(false)} onError={() => { setFailedVideo(videoSource); setVideoPlaying(false); }}
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-300', videoPlaying ? 'opacity-100' : 'opacity-0')} /></div>}
      </div>
    </div>
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-ink/90 via-transparent to-ink/15" />
    {actualImage ? <span className="sr-only">Porträtt av {name}</span> : <span className="pointer-events-none absolute inset-x-3 bottom-3 z-20 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-off/75">Designillustration · porträtt saknas</span>}
  </div>;
}
