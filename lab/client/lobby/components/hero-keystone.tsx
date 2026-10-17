"use client";

import Image from "next/image";
import { useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { HeroPhase } from "@/hooks/use-hero-sequence";

const CLIP_SECONDS = 10;

type HeroKeystoneProps = {
  phase: HeroPhase;
  scale: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  onPlaying: () => void;
  onEnded: () => void;
  onError: () => void;
};

/**
 * Opening still → clip → closing still, stacked so each hand-off is a plain
 * cross-fade between identical frames. The clip's first frame is the opening
 * keystone and its last frame is the closing one.
 */
export function HeroKeystone({ phase, scale, videoRef, onPlaying, onEnded, onError }: HeroKeystoneProps) {
  const [endReady, setEndReady] = useState(false);

  const clipMounted = phase !== "cancelled";
  const clipVisible = phase === "playing" || (phase === "done" && !endReady);
  const endVisible = phase === "done" && endReady;
  const endMounted = phase === "playing" || phase === "done";

  return (
    <div className="absolute inset-0" style={{ transform: `scale(${scale})` }}>
      <Image
        src="/admin/_assets/lobby/images/lobby/hero-table.png"
        alt="Dealerns händer lägger två kort på ett mörkt blackjackbord"
        fill
        sizes="100vw"
        className="object-cover"
        priority
      />

      {endMounted && (
        <Image
          src="/admin/_assets/lobby/images/lobby/hero-end.png"
          alt="Ett ess och en limegrön marker ligger på det tomma bordet framför dealern"
          fill
          sizes="100vw"
          className={cn("object-cover transition-opacity duration-500", endVisible ? "opacity-100" : "opacity-0")}
          onLoad={() => setEndReady(true)}
        />
      )}

      {clipMounted && (
        <video
          ref={videoRef}
          src="/admin/_assets/lobby/videos/hero-end.mp4"
          muted
          playsInline
          preload="auto"
          aria-hidden
          tabIndex={-1}
          onPlaying={onPlaying}
          onEnded={onEnded}
          onError={onError}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            clipVisible ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-px origin-left bg-lime/80 transition-opacity duration-500",
          phase === "playing" ? "opacity-100" : "opacity-0",
        )}
        style={{
          transform: phase === "playing" || phase === "done" ? "scaleX(1)" : "scaleX(0)",
          transition: phase === "playing" ? `transform ${CLIP_SECONDS}s linear, opacity 500ms` : "opacity 500ms",
        }}
      />
    </div>
  );
}
