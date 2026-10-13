"use client";

import Image from "next/image";
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Portrait } from "@/lib/dealer-portraits.mjs";
import { usePortraitVideo } from "@/hooks/use-portrait-video";
import { cn } from "@/lib/utils";
import { DEALER_KEY_FILTER_ID } from "@/components/dealer-key-filter";

type DealerPortraitProps = {
  dealer: Portrait;
  /** Environment painted in behind the dealer when hovered, selected or forced. */
  backdrop: string;
  sizes: string;
  /** Idle clips repeat every 50 s after completion, even when the parent is blurred/locked. */
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
  const { rootRef, videoRef, clip, playing, finish, hover, leave, onPlaying } = usePortraitVideo({
    clips: dealer.clips, idle, interactive, playOnMount,
  });
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
    if (event.pointerType === "mouse") hover();
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
      onPointerLeave={leave}
      onFocus={hover}
      onBlur={leave}
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
              ref={videoRef}
              tabIndex={-1}
              src={clip}
              muted
              playsInline
              preload="auto"
              onPlaying={onPlaying}
              onEnded={finish}
              onError={finish}
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
