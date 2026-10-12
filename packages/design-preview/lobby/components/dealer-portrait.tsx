"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Dealer } from "@/lib/lobby-data";
import { cn } from "@/lib/utils";
import { DEALER_KEY_FILTER_ID } from "@/components/dealer-key-filter";

const FIRST_DELAY: [number, number] = [5_000, 15_000];
const IDLE_DELAY: [number, number] = [35_000, 65_000];
const HOVER_PLAY_DELAY = 220;

type DealerPortraitProps = {
  dealer: Dealer;
  /** Environment painted in behind the dealer when hovered, selected or forced. */
  backdrop: string;
  sizes: string;
  /** Random idle clips keep playing even when the parent is blurred/locked. */
  idle?: boolean;
  /** Hover/focus (via a parent `group`) paints the backdrop and brings colour. */
  interactive?: boolean;
  /** Keep the backdrop painted regardless of hover. */
  painted?: boolean;
  /** Keep the portrait in colour regardless of hover. */
  colored?: boolean;
  /** Play a clip shortly after mounting (used by the detail dialog). */
  playOnMount?: boolean;
  live?: boolean;
  className?: string;
  priority?: boolean;
  alt?: string;
  children?: ReactNode;
};

function randomBetween([min, max]: [number, number]) {
  return min + Math.random() * (max - min);
}

export function DealerPortrait({
  dealer,
  backdrop,
  sizes,
  idle = true,
  interactive = true,
  painted = false,
  colored = false,
  playOnMount = false,
  live = false,
  className,
  priority,
  alt = "",
  children,
}: DealerPortraitProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const [clip, setClip] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  const clips = dealer.clips ?? [];
  const hasClips = clips.length > 0;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "80px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!idle || !visible || !hasClips || clip) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const delay = playOnMount && round === 0 ? 700 : randomBetween(round === 0 ? FIRST_DELAY : IDLE_DELAY);
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") {
        setRound((r) => r + 1);
        return;
      }
      setClip(clips[Math.floor(Math.random() * clips.length)]);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [idle, visible, hasClips, clip, round, clips, playOnMount]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // The still returns instantly underneath, then the clip fades out on top, so the
  // environment never bleeds through a half-transparent dealer.
  const finishClip = () => {
    setPlaying(false);
    window.setTimeout(() => {
      setClip(null);
      setRound((r) => r + 1);
    }, 350);
  };

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });

    if (!hasClips || clip || event.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hoverTimer.current = window.setTimeout(() => {
      setClip(clips[Math.floor(Math.random() * clips.length)]);
    }, HOVER_PLAY_DELAY);
  };

  const handlePointerLeave = () => {
    window.clearTimeout(hoverTimer.current);
  };

  const style = {
    "--x": `${origin.x}%`,
    "--y": `${origin.y}%`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={cn("relative overflow-hidden bg-ink", className)}
    >
      <Image src={backdrop} alt="" fill sizes={sizes} className="object-cover" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-ink/40"
      />

      {/* The white studio sheet; wiped away from the cursor to paint the environment in */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-[#f6f5f1] transition-[clip-path] duration-700 ease-out motion-reduce:transition-none",
          "[clip-path:circle(150%_at_var(--x)_var(--y))]",
          interactive &&
            "group-hover:[clip-path:circle(0%_at_var(--x)_var(--y))] group-focus-visible:[clip-path:circle(0%_at_var(--x)_var(--y))]",
          painted && "[clip-path:circle(0%_at_var(--x)_var(--y))]",
        )}
      />

      <div
        className={cn(
          "absolute inset-0 transition-[filter,transform] duration-500 motion-reduce:transition-none",
          colored ? "grayscale-0" : "grayscale",
          interactive && "group-hover:scale-[1.03] group-hover:grayscale-0 group-focus-visible:grayscale-0",
        )}
      >
        {/* Oversized by 4px so the edge choke in the filter never opens a seam along the frame */}
        <div className="absolute -inset-1" style={{ filter: `url(#${DEALER_KEY_FILTER_ID})` }}>
          <Image
            src={dealer.image}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn("object-cover", playing ? "opacity-0 transition-opacity delay-200 duration-150" : "opacity-100")}
          />
          {clip && (
            <video
              key={clip}
              src={clip}
              autoPlay
              muted
              playsInline
              preload="auto"
              onPlaying={() => setPlaying(true)}
              onEnded={finishClip}
              onError={finishClip}
              aria-hidden
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                playing ? "opacity-100" : "opacity-0",
              )}
            />
          )}
        </div>
      </div>

      {children}

      {live && (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-lime backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse-dot" aria-hidden />
          Live
        </span>
      )}
    </div>
  );
}
