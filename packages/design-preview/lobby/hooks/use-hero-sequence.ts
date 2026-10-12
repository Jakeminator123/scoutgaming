"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

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
 * Hold the opening keystone for 7 s. If the visitor has not scrolled more than a
 * third of the hero by then, play the clip. When the chip lands, pull the page
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
        video.removeAttribute("src");
        video.load();
      }
    }
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current;
      if (!section || autoScrollingRef.current) return;
      if (-section.getBoundingClientRect().top > window.innerHeight / 3) {
        visitorScrolledRef.current = true;
        if (phaseRef.current === "idle" || phaseRef.current === "armed") transition("cancelled");
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sectionRef, transition]);

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
    const watch = () => {
      if (video.currentTime < SCROLL_CUE_SECONDS) {
        raf = requestAnimationFrame(watch);
        return;
      }
      if (visitorScrolledRef.current) return;
      const targetY = window.scrollY + section.getBoundingClientRect().top + window.innerHeight * HERO_PARALLAX_VH;
      autoScrollingRef.current = true;
      animateScrollTo(targetY, AUTO_SCROLL_MS, () => {
        autoScrollingRef.current = false;
      });
    };
    raf = requestAnimationFrame(watch);
    return () => cancelAnimationFrame(raf);
  }, [phase, sectionRef]);

  return {
    phase,
    videoRef,
    onPlaying: () => transition("playing"),
    onEnded: () => transition("done"),
  };
}

function animateScrollTo(targetY: number, duration: number, onDone: () => void) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startedAt = performance.now();
  const interruptEvents = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  let cancelled = false;

  const finish = () => {
    interruptEvents.forEach((name) => window.removeEventListener(name, interrupt));
    onDone();
  };
  function interrupt() {
    cancelled = true;
    finish();
  }
  interruptEvents.forEach((name) => window.addEventListener(name, interrupt, { passive: true }));

  const frame = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - startedAt) / duration);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    window.scrollTo({ top: startY + distance * eased, behavior: "instant" });
    if (t < 1) requestAnimationFrame(frame);
    else finish();
  };
  requestAnimationFrame(frame);
}
