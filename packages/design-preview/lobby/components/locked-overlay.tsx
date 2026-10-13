"use client";

import { ArrowUp, Lock } from "lucide-react";

type LockedOverlayProps = {
  title: string;
  step: string;
  onClick: () => void;
};

export function LockedOverlay({ title, step, onClick }: LockedOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-5">
      <button
        type="button"
        onClick={onClick}
        className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-background/85 px-8 py-7 text-center shadow-2xl backdrop-blur-md transition-colors hover:border-lime focus-visible:border-lime focus-visible:outline-none"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden />
        </span>
        <span className="display text-xl text-off md:text-2xl">{title}</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-lime">
          <ArrowUp className="h-3 w-3" aria-hidden />
          Till steg {step}
        </span>
      </button>
    </div>
  );
}
