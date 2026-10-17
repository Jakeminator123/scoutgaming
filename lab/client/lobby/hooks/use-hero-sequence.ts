"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { animateScrollTo } from "@/lib/scroll-motion.mjs";

export type HeroPhase = "idle" | "armed" | "playing" | "done" | "cancelled";

/** How long the opening keystone holds before the clip starts. */
const IDLE_MS = 7000;
/** If the clip still is not buffered this long after arming, give up quietly. */
const BUFFER_GRACE_MS = 10000;
/** Seconds into the clip where the chip settles next to the card. */
const SCROLL_CUE_SECONDS = 7.2;
/** The auto-scroll ends together with the clip (10 s). */
const AUTO_SCROLL_MS = 2400;
/** The hero parallax spans this many viewport heights; scrolling this far closes it. */
export const HERO_PARALLAX_VH = 1.6;

/**
 * Hold the opening keystone for 7 s. If the visitor has not interacted or
 * scrolled by then, play the clip. When the chip lands, pull the page
 * down until the door parallax is fully open. Any wheel / touch / key input
 * hands control back to the visitor immediately.
 */
export function useHeroSequence(sectionRef: RefObject<HTMLElement | null>) {
  const [phase, setPhase] = useState<HeroPhase>("idle");
  const phaseRef = useRef<HeroPhase>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const visitorScrolledRef = useRef(false);
  const autoScrollingRef = useRef(false);

  const transition = useCallback((next: HeroPhase) => {
    if (phaseRef.current === next) return;
    if (next === "cancelled") {
      // Drop the 6 MB download for visitors who clearly came to scroll.
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    }
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const interrupt = () => {
      visitorScrolledRef.current = true;
      if (phaseRef.current === "idle" || phaseRef.current === "armed") transition("cancelled");
    };
    const onScroll = () => {
      if (!autoScrollingRef.current && window.scrollY > 4) interrupt();
    };
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopMotion = () => {
      if (document.hidden || preference.matches) transition("cancelled");
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    events.forEach(name => window.addEventListener(name, interrupt, { passive: true }));
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", stopMotion);
    preference.addEventListener("change", stopMotion);
    onScroll();
    stopMotion();
    return () => {
      events.forEach(name => window.removeEventListener(name, interrupt));
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", stopMotion);
      preference.removeEventListener("change", stopMotion);
    };
  }, [transition]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      transition("cancelled");
      return;
    }
    const timer = window.setTimeout(() => {
      if (phaseRef.current === "idle") transition("armed");
    }, IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [transition]);

  useEffect(() => {
    if (phase !== "armed") return;
    const video = videoRef.current;
    if (!video) {
      transition("cancelled");
      return;
    }
    let disposed = false;
    const giveUp = window.setTimeout(() => {
      if (!disposed && phaseRef.current === "armed") transition("cancelled");
    }, BUFFER_GRACE_MS);

    const start = () => {
      if (disposed || phaseRef.current !== "armed") return;
      if (document.hidden) {
        document.addEventListener("visibilitychange", start, { once: true });
        return;
      }
      video.play().catch(() => {
        if (!disposed) transition("cancelled");
      });
    };
    start();

    return () => {
      disposed = true;
      window.clearTimeout(giveUp);
      document.removeEventListener("visibilitychange", start);
    };
  }, [phase, transition]);

  useEffect(() => {
    if (phase !== "playing") return;
    const video = videoRef.current;
    const section = sectionRef.current;
    if (!video || !section) return;

    let raf = 0;
    let stopScroll: (() => void) | undefined;
    const watch = () => {
      if (video.currentTime < SCROLL_CUE_SECONDS) {
        raf = requestAnimationFrame(watch);
        return;
      }
      if (visitorScrolledRef.current) return;
      const targetY = window.scrollY + section.getBoundingClientRect().top + window.innerHeight * HERO_PARALLAX_VH;
      autoScrollingRef.current = true;
      stopScroll = animateScrollTo(targetY, AUTO_SCROLL_MS, () => {
        autoScrollingRef.current = false;
      });
    };
    raf = requestAnimationFrame(watch);
    return () => {
      cancelAnimationFrame(raf);
      stopScroll?.();
    };
  }, [phase, sectionRef]);

  return {
    phase,
    videoRef,
    onPlaying: () => { if (phaseRef.current === "armed") transition("playing"); },
    onEnded: () => { if (phaseRef.current === "playing") transition("done"); },
    onError: () => transition("cancelled"),
  };
}
