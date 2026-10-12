"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type HeroPhase = 'idle' | 'armed' | 'playing' | 'done' | 'cancelled';
const IDLE_MS = 7000;
const BUFFER_GRACE_MS = 10000;
const TAKEOVER_PROGRESS = 0.3;
export const HERO_PARALLAX_VH = 1.6;

/** The takeover threshold uses the entire parallax span, not a fraction of one viewport. */
export function heroParallaxProgress(sectionTop: number, viewportHeight: number) {
  if (!Number.isFinite(sectionTop) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return 1;
  return Math.max(0, Math.min(1, -sectionTop / (viewportHeight * HERO_PARALLAX_VH)));
}

export function heroCanTakeOver(sectionTop: number, viewportHeight: number) {
  // Include the exact boundary even when division rounds 30% slightly upward.
  return heroParallaxProgress(sectionTop, viewportHeight) <= TAKEOVER_PROGRESS + Number.EPSILON;
}

/** Playback time is the clock: buffering, pause and a hidden tab cannot advance the scroll. */
export function heroPlaybackScroll(startY: number, targetY: number, currentTime: number, duration: number, startTime = 0) {
  if (![startY, targetY, currentTime, duration, startTime].every(Number.isFinite) || duration <= startTime) return null;
  const progress = Math.max(0, Math.min(1, (currentTime - startTime) / (duration - startTime)));
  return startY + (targetY - startY) * progress;
}

/** After seven visible seconds, start film and parallax together if the visitor remains within 30%. */
export function useHeroSequence(sectionRef: RefObject<HTMLElement | null>) {
  const [phase, setPhase] = useState<HeroPhase>('idle');
  const [run, setRun] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const phaseRef = useRef<HeroPhase>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const replayRequestedRef = useRef(false);
  const canTakeOver = useCallback(() => {
    const section = sectionRef.current;
    return Boolean(section && heroCanTakeOver(section.getBoundingClientRect().top, window.innerHeight));
  }, [sectionRef]);
  const stopScroll = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);
  const transition = useCallback((next: HeroPhase) => {
    if (phaseRef.current === next) return;
    if (next === 'cancelled') videoRef.current?.pause();
    if (next === 'cancelled' || next === 'done' || next === 'idle') stopScroll();
    phaseRef.current = next; setPhase(next);
  }, [stopScroll]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(media.matches); if (media.matches) transition('cancelled'); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [transition]);

  useEffect(() => {
    // Browsing during idle is allowed. Decide from the current position when the timer expires.
    const intent = () => {
      if (phaseRef.current === 'armed' || phaseRef.current === 'playing') transition('cancelled');
    };
    const scroll = () => {
      if (phaseRef.current === 'armed' && !canTakeOver()) transition('cancelled');
    };
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    events.forEach(event => window.addEventListener(event, intent, { passive: true }));
    window.addEventListener('scroll', scroll, { passive: true });
    return () => { events.forEach(event => window.removeEventListener(event, intent)); window.removeEventListener('scroll', scroll); stopScroll(); };
  }, [canTakeOver, stopScroll, transition]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let remaining = replayRequestedRef.current ? 0 : IDLE_MS;
    replayRequestedRef.current = false;
    let started: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visibility = () => {
      clearTimeout(timer);
      if (started !== null) remaining = Math.max(0, remaining - (performance.now() - started));
      started = null;
      if (document.hidden || phaseRef.current !== 'idle') return;
      started = performance.now();
      timer = setTimeout(() => {
        if (!document.hidden && phaseRef.current === 'idle') transition(canTakeOver() ? 'armed' : 'cancelled');
      }, remaining);
    };
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [run, canTakeOver, transition]);

  useEffect(() => {
    if (phase !== 'armed') return;
    const video = videoRef.current;
    if (!video) { transition('cancelled'); return; }
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      clearTimeout(timeout);
      if (disposed || document.hidden || phaseRef.current !== 'armed') return;
      if (!canTakeOver()) { transition('cancelled'); return; }
      timeout = setTimeout(() => { if (!disposed && phaseRef.current === 'armed') transition('cancelled'); }, BUFFER_GRACE_MS);
      video.play().catch(() => { if (!disposed) transition('cancelled'); });
    };
    start(); document.addEventListener('visibilitychange', start);
    return () => { disposed = true; clearTimeout(timeout); document.removeEventListener('visibilitychange', start); };
  }, [phase, run, canTakeOver, transition]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const video = videoRef.current, section = sectionRef.current;
    if (!video || !section) return;
    const startY = window.scrollY;
    const startTime = video.currentTime;
    const target = startY + section.getBoundingClientRect().top + window.innerHeight * HERO_PARALLAX_VH;
    targetRef.current = target;
    let disposed = false;
    const watch = () => {
      frameRef.current = null;
      if (disposed || phaseRef.current !== 'playing' || document.hidden) return;
      const nextY = heroPlaybackScroll(startY, target, video.currentTime, video.duration, startTime);
      if (nextY !== null && !video.paused) window.scrollTo({ top: nextY, behavior: 'instant' });
      frameRef.current = requestAnimationFrame(watch);
    };
    const visibility = () => {
      if (document.hidden) { video.pause(); stopScroll(); }
      else if (phaseRef.current === 'playing') {
        video.play().catch(() => { if (!disposed) transition('cancelled'); });
        if (frameRef.current === null) frameRef.current = requestAnimationFrame(watch);
      }
    };
    frameRef.current = requestAnimationFrame(watch);
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; document.removeEventListener('visibilitychange', visibility); stopScroll(); };
  }, [phase, run, sectionRef, stopScroll, transition]);

  const replay = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopScroll(); videoRef.current?.pause(); targetRef.current = null;
    replayRequestedRef.current = true;
    window.scrollTo({ top: window.scrollY + (sectionRef.current?.getBoundingClientRect().top ?? 0), behavior: 'instant' });
    transition('idle'); setRun(value => value + 1);
  }, [sectionRef, stopScroll, transition]);
  return { phase, run, reducedMotion, replay, videoRef,
    onPlaying: () => {
      if (document.hidden) { videoRef.current?.pause(); return; }
      if (phaseRef.current === 'playing') return; // Resuming after a hidden tab keeps the same playback/scroll plan.
      if (phaseRef.current !== 'armed') { videoRef.current?.pause(); return; }
      transition(canTakeOver() ? 'playing' : 'cancelled');
    },
    onEnded: () => {
      if (phaseRef.current !== 'playing') return;
      if (!document.hidden && targetRef.current !== null) window.scrollTo({ top: targetRef.current, behavior: 'instant' });
      transition('done');
    },
  };
}
