"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_IDS, scrollToSection, useLobby } from "@/components/lobby-provider";
import { HeroKeystone } from "@/components/hero-keystone";

import { useIsMobile } from "@/hooks/use-mobile";
import { HERO_PARALLAX_VH, useHeroSequence } from "@/hooks/use-hero-sequence";

const sideImages = [
  { src: "/admin/_assets/lobby/images/lobby/room-salongen.png", alt: "Designillustration av klassiskt blackjackrum i valnöt och mässing", label: "Designmiljö · klassisk", position: "left" },
  { src: "/admin/_assets/lobby/images/lobby/room-studion.png", alt: "Designillustration av nordisk studio med limegrön ljuslinje", label: "Designmiljö · studio", position: "left" },
  { src: "/admin/_assets/lobby/images/lobby/room-loungen.png", alt: "Designillustration av neonlounge med blackjackbord", label: "Designmiljö · lounge", position: "right" },
  { src: "/admin/_assets/lobby/images/lobby/detail-chips.png", alt: "Närbild på svarta marker med limegrön kant", label: "Insats", position: "right" },
] as const;



export function HeroSection() {
  const { operators, dealers, rooms, status } = useLobby();
  const openOperators = operators.filter(op => op.status === "open").length;
  const games = [...new Set(rooms.map(room => room.game))].map(game => ({ label: game === "roulette" ? "Roulette" : "Blackjack", active: true }));
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const isMobile = useIsMobile();
  const sequence = useHeroSequence(sectionRef);
  const cinematic = sequence.phase === "playing";

  useEffect(() => {
    let raf: number | null = null;
    const update = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const scrollable = window.innerHeight * HERO_PARALLAX_VH;
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
      setScrollProgress(progress);
    };
    const handleScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const textOpacity = Math.max(0, 1 - scrollProgress / 0.25);
  const imageProgress = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.8));
  const eased = 1 - Math.pow(1 - imageProgress, 3);

  const perSide = isMobile ? 1 : 2;
  const sideShare = isMobile ? 30 : 40;
  const centerWidth = 100 - eased * sideShare * 2;
  const sideWidth = eased * sideShare;
  const gap = eased * 10;
  const frameRadius = eased * 14;
  const frameInset = eased * 12;
  const labelOpacity = Math.max(0, (imageProgress - 0.7) / 0.3);

  const left = sideImages.filter((img) => img.position === "left").slice(0, perSide);
  const right = sideImages.filter((img) => img.position === "right").slice(0, perSide);

  return (
    <section id="hero" ref={sectionRef} className="relative bg-background">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div
          className="relative flex h-full w-full items-stretch justify-center"
          style={{ gap: `${gap}px`, perspective: "1400px", paddingBlock: `${frameInset}px` }}
        >
          <DoorColumn
            side="left"
            images={left}
            width={sideWidth}
            gap={gap}
            eased={eased}
            progress={imageProgress}
            radius={frameRadius}
            labelOpacity={labelOpacity}
          />

          <div
            className="relative h-full overflow-hidden transition-[box-shadow] duration-300"
            style={{
              width: `${centerWidth}%`,
              flex: "0 0 auto",
              borderRadius: `${frameRadius}px`,
              boxShadow: eased > 0.05 ? `inset 0 0 0 1px color-mix(in oklab, var(--scout-brass) ${Math.round(eased * 80)}%, transparent)` : "none",
            }}
          >
            <HeroKeystone
              phase={sequence.phase}
              scale={1 + eased * 0.08}
              videoRef={sequence.videoRef}
              onPlaying={sequence.onPlaying}
              onEnded={sequence.onEnded}
            />
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/25 transition-opacity duration-1000",
                cinematic ? "opacity-30" : "opacity-100",
              )}
              aria-hidden
            />
            <div
              className={cn("bg-grid absolute inset-0 transition-opacity duration-1000", cinematic ? "opacity-0" : "opacity-70")}
              aria-hidden
            />

            <div
              className="absolute inset-0 flex flex-col justify-end px-5 pb-28 pt-24 md:px-10 md:pb-32 lg:px-16"
              style={{ opacity: textOpacity, pointerEvents: textOpacity < 0.05 || cinematic ? "none" : "auto" }}
            >
              <div
                className={cn(
                  "grid w-full gap-10 transition-opacity duration-700 lg:grid-cols-12 lg:items-end",
                  cinematic ? "opacity-0" : "opacity-100",
                )}
              >
                <div className="lg:col-span-8">
                  <span className="inline-flex items-center gap-2 rounded-full border border-lime/40 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse-dot" aria-hidden />
                    <span className="eyebrow">Scoutgaming / Spellobby</span>
                  </span>

                  <h1 className="display mt-6 text-[clamp(3.25rem,10vw,8.5rem)] leading-[0.92] text-off">
                    <span className="block animate-[slideUp_0.8s_ease-out_forwards] opacity-0">Ditt bolag.</span>
                    <span
                      className="block animate-[slideUp_0.8s_ease-out_forwards] text-lime opacity-0"
                      style={{ animationDelay: "120ms" }}
                    >
                      Ditt bord.
                    </span>
                  </h1>

                  <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-foreground/80 md:text-xl">
                    Börja med ditt spelbolag. Då öppnas bolagets spelrum – och i rummet väljer du dealer och miljö.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection(STEP_IDS.operator)}
                      className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-85"
                    >
                      Välj bolag
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                    <ul className="flex flex-wrap gap-2" aria-label="Spel">
                      {games.map((game) => (
                        <li
                          key={game.label}
                          className={
                            game.active
                              ? "rounded-full border border-lime/60 bg-lime/10 px-3.5 py-1.5 text-xs font-semibold text-lime"
                              : "rounded-full border border-border bg-background/40 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm"
                          }
                        >
                          {game.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="lg:col-span-4 lg:justify-self-end">
                  <div className="flex items-center gap-4">

                    <div>
                      <p className="text-sm font-medium text-off">{status === "ready" ? `${dealers.length} publicerade dealers` : "Publicerat spelutbud"}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {status === "ready" ? `${openOperators} bolag med rum · ${rooms.length} spelrum` : status === "error" ? "Spelkatalogen är otillgänglig" : "Hämtas från spelkatalogen"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pb-7 md:px-10 lg:px-16"
              style={{ opacity: textOpacity }}
            >
              <span className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span
                  className={cn("flex items-center gap-2 transition-opacity duration-700", cinematic ? "opacity-0" : "opacity-100")}
                >
                  <ArrowDown className="h-3 w-3 animate-bounce" aria-hidden />
                  Scrolla för att öppna dörrarna
                </span>
                <span
                  className={cn(
                    "absolute left-0 flex items-center gap-2 text-lime transition-opacity duration-700",
                    cinematic ? "opacity-100" : "opacity-0",
                  )}
                  aria-live="polite"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse-dot" aria-hidden />
                  {cinematic ? "Bordet öppnar" : ""}
                </span>
              </span>
              <span
                className={cn(
                  "hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-opacity duration-700 md:inline",
                  cinematic ? "opacity-0" : "opacity-100",
                )}
              >
                01 Bolag → 02 Spelrum → 03 Dealer & miljö
              </span>
            </div>
          </div>

          <DoorColumn
            side="right"
            images={right}
            width={sideWidth}
            gap={gap}
            eased={eased}
            progress={imageProgress}
            radius={frameRadius}
            labelOpacity={labelOpacity}
          />
        </div>
      </div>

      <div style={{ height: `${HERO_PARALLAX_VH * 100}vh` }} />
    </section>
  );
}

type DoorColumnProps = {
  side: "left" | "right";
  images: ReadonlyArray<{ src: string; alt: string; label: string }>;
  width: number;
  gap: number;
  eased: number;
  progress: number;
  radius: number;
  labelOpacity: number;
};

function DoorColumn({ side, images, width, gap, eased, progress, radius, labelOpacity }: DoorColumnProps) {
  const direction = side === "left" ? -1 : 1;
  const translate = direction * (1 - eased) * 100;
  const hidden = eased < 0.05;

  return (
    <div
      className="flex h-full flex-row will-change-transform"
      style={{
        width: `${width}%`,
        gap: `${gap}px`,
        transform: `translateX(${translate}%)`,
        opacity: eased,
        transformStyle: "preserve-3d",
      }}
      aria-hidden={hidden}
    >
      {images.map((img, i) => {
        const order = side === "left" ? images.length - 1 - i : i;
        const swing = direction * -1 * (1 - progress) * (58 + order * 10);
        const scale = 0.6 + progress * 0.4;
        return (
          <div
            key={img.src}
            className="relative h-full flex-1 overflow-hidden"
            style={{
              transform: `rotateY(${swing}deg) scale(${scale})`,
              transformOrigin: side === "left" ? "right center" : "left center",
              borderRadius: `${radius}px`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(--scout-brass) ${Math.round(eased * 80)}%, transparent), 0 30px 60px -30px rgba(0,0,0,0.8)`,
              willChange: "transform",
            }}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              className="object-cover"
              style={{ transform: `scale(${1.3 - eased * 0.3})` }}
            />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background/90 to-transparent" aria-hidden />
            <span
              className="absolute bottom-6 left-5 font-mono text-[10px] uppercase tracking-[0.22em] text-off"
              style={{ opacity: labelOpacity }}
            >
              {img.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
