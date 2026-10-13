"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Lock, Menu, Plus, X } from "lucide-react";
import { ScoutLogo } from "@/components/scout-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STEP_IDS, scrollToSection, useLobby } from "@/components/lobby-provider";
import { HOME_URL, playUrlFor } from "@/lib/lobby-data";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "locked";

const STEP_ORDER = [STEP_IDS.operator, STEP_IDS.room, STEP_IDS.dealer];

export function Header() {
  const { operators, operator, room, dealer, selectOperator } = useLobby();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [inView, setInView] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sections = STEP_ORDER.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setInView(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const states: Record<string, StepState> = {
    [STEP_IDS.operator]: operator ? "done" : "current",
    [STEP_IDS.room]: !operator ? "locked" : room ? "done" : "current",
    [STEP_IDS.dealer]: !room ? "locked" : dealer ? "done" : "current",
  };

  const playUrl = operator && room && dealer ? playUrlFor({ operator, room, dealer }) : null;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        isScrolled ? "border-border/70 bg-background/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="flex h-16 items-center justify-between px-5 md:px-10 lg:px-16">
        <div className="flex items-center gap-4">
          <Link href="#hero" aria-label="Scoutgaming spellobby, till toppen">
            <ScoutLogo className="text-xl" />
          </Link>
          <span aria-hidden className="hidden h-5 w-px bg-border md:block" />
          <span className="eyebrow hidden md:inline">{"// Spellobby"}</span>
        </div>

        <nav aria-label="Steg" className="hidden items-center lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={pillClass(states[STEP_IDS.operator], inView === STEP_IDS.operator)}
                aria-label={operator ? `Steg 1, bolag: ${operator.name}. Byt bolag` : "Steg 1, välj bolag"}
              >
                <StepBadge index="01" state={states[STEP_IDS.operator]} />
                <span className="flex items-center gap-2">
                  {operator && (
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: operator.accent }} aria-hidden />
                  )}
                  {operator ? operator.name : "Bolag"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} className="w-64 border-border bg-popover p-1.5">
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Välj spelbolag
              </DropdownMenuLabel>
              {operators.map((op) => {
                const soon = op.status === "empty";
                const selected = operator?.id === op.id;
                return (
                  <DropdownMenuItem
                    key={op.id}
                    disabled={soon}
                    onSelect={() => selectOperator(op.id, { advance: true })}
                    className="flex items-center gap-3 rounded-sm py-2"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: op.accent }} aria-hidden />
                    <span className="flex-1 text-sm">{op.name}</span>
                    {soon ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Inga rum</span>
                    ) : selected ? (
                      <Check className="h-3.5 w-3.5 text-lime" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="flex items-center gap-3 rounded-sm py-2 text-muted-foreground">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span className="flex-1 text-sm">Bolag hanteras i administrationen</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Connector done={states[STEP_IDS.operator] === "done"} />

          <StepButton
            index="02"
            label={room ? room.name : "Spelrum"}
            state={states[STEP_IDS.room]}
            inView={inView === STEP_IDS.room}
            lockedHint="Välj bolag först"
            onClick={() => scrollToSection(STEP_IDS.room)}
          />

          <Connector done={states[STEP_IDS.room] === "done"} />

          <StepButton
            index="03"
            label={dealer ? dealer.name : "Dealer"}
            state={states[STEP_IDS.dealer]}
            inView={inView === STEP_IDS.dealer}
            lockedHint="Välj spelrum först"
            onClick={() => scrollToSection(STEP_IDS.dealer)}
          />
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {playUrl ? (
            <a
              href={playUrl}
              className="inline-flex items-center gap-2 rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-ink transition-opacity hover:opacity-85"
            >
              Spela
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : (
            <>
              <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                18+ · Demo
              </span>
              <a
                href={HOME_URL}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Till startsidan
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          className="text-foreground md:hidden"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMenuOpen ? "Stäng meny" : "Öppna meny"}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-border bg-background px-5 py-6 md:hidden">
          <nav aria-label="Steg" className="flex flex-col">
            <div className="py-3">
              <p className="flex items-center gap-3 text-lg text-foreground">
                <span className="font-mono text-xs text-lime">01</span>
                {operator ? operator.name : "Bolag"}
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 pl-7">
                {operators.map((op) => {
                  const soon = op.status === "empty";
                  const selected = operator?.id === op.id;
                  return (
                    <li key={op.id}>
                      <button
                        type="button"
                        disabled={soon}
                        onClick={() => {
                          selectOperator(op.id, { advance: true });
                          setIsMenuOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                          selected ? "border-lime text-off" : "border-border text-muted-foreground",
                          soon && "opacity-50",
                        )}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: op.accent }} aria-hidden />
                        <span className="flex-1 truncate">{op.name}</span>
                        {soon && <span className="font-mono text-[9px] uppercase tracking-[0.18em]">Inga rum</span>}
                      </button>
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Se administrationen
                </li>
              </ul>
            </div>

            <MobileRow
              index="02"
              label={room ? room.name : "Spelrum"}
              state={states[STEP_IDS.room]}
              onClick={() => {
                scrollToSection(STEP_IDS.room);
                setIsMenuOpen(false);
              }}
            />
            <MobileRow
              index="03"
              label={dealer ? dealer.name : "Dealer"}
              state={states[STEP_IDS.dealer]}
              onClick={() => {
                scrollToSection(STEP_IDS.dealer);
                setIsMenuOpen(false);
              }}
            />

            {playUrl ? (
              <a
                href={playUrl}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink"
              >
                Spela med {dealer?.name}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            ) : (
              <a href={HOME_URL} className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground">
                Till startsidan
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function pillClass(state: StepState, inView: boolean) {
  return cn(
    "group flex items-center gap-2.5 rounded-full px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-lime/60",
    state === "locked" ? "cursor-not-allowed text-muted-foreground/60" : "text-foreground hover:bg-secondary/70",
    inView && state !== "locked" && "bg-secondary/70",
  );
}

function StepBadge({ index, state }: { index: string; state: StepState }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] transition-colors",
        state === "done" && "border-lime bg-lime text-ink",
        state === "current" && "border-lime bg-lime/10 text-lime",
        state === "locked" && "border-border text-muted-foreground/60",
      )}
    >
      {state === "done" ? <Check className="h-3 w-3" aria-hidden /> : state === "locked" ? <Lock className="h-2.5 w-2.5" aria-hidden /> : index}
    </span>
  );
}

function StepButton({
  index,
  label,
  state,
  inView,
  lockedHint,
  onClick,
}: {
  index: string;
  label: string;
  state: StepState;
  inView: boolean;
  lockedHint: string;
  onClick: () => void;
}) {
  const locked = state === "locked";
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      aria-disabled={locked}
      title={locked ? lockedHint : undefined}
      aria-current={inView && !locked ? "location" : undefined}
      className={pillClass(state, inView)}
    >
      <StepBadge index={index} state={state} />
      {label}
    </button>
  );
}

function Connector({ done }: { done: boolean }) {
  return <span aria-hidden className={cn("mx-1 h-px w-8 transition-colors", done ? "bg-lime/60" : "bg-border")} />;
}

function MobileRow({
  index,
  label,
  state,
  onClick,
}: {
  index: string;
  label: string;
  state: StepState;
  onClick: () => void;
}) {
  const locked = state === "locked";
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      aria-disabled={locked}
      className={cn(
        "flex items-center gap-3 border-t border-border py-3 text-left text-lg",
        locked ? "text-muted-foreground/60" : "text-foreground",
      )}
    >
      <span className="font-mono text-xs text-lime">{index}</span>
      <span className="flex-1">{label}</span>
      {locked ? (
        <Lock className="h-4 w-4" aria-hidden />
      ) : state === "done" ? (
        <Check className="h-4 w-4 text-lime" aria-hidden />
      ) : null}
    </button>
  );
}
