"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { STEP_IDS, scrollToSection, useLobby } from "@/components/lobby-provider";
import { playUrlFor } from "@/lib/lobby-data";
import { cn } from "@/lib/utils";

export function SelectionTicket() {
  const { operator, room, dealer, step, reset, prepareLaunch } = useLobby();

  if (!operator) return null;

  const rows = [
    { index: "01", label: "Bolag", value: operator.name, id: STEP_IDS.operator, accent: operator.accent },
    { index: "02", label: "Spelbord", value: room?.name, id: STEP_IDS.room },
    { index: "03", label: "Dealer", value: dealer?.name, id: STEP_IDS.dealer },
  ];

  const nextId = step === 2 ? STEP_IDS.room : STEP_IDS.dealer;

  return (
    <aside
      aria-label="Ditt val"
      className="fixed inset-x-3 bottom-3 z-40 animate-reveal-up md:inset-x-0 md:bottom-5 md:flex md:justify-center"
    >
      <div className="flex items-stretch overflow-hidden rounded-full border border-border bg-card/95 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={reset}
          aria-label="Börja om"
          title="Börja om"
          className="hidden items-center border-r border-dashed border-border px-3 text-muted-foreground transition-colors hover:text-foreground md:flex"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>

        <ul className="flex flex-1 items-center divide-x divide-border overflow-x-auto">
          {rows.map((row) => (
            <li key={row.index} className="shrink-0">
              <button
                type="button"
                onClick={() => scrollToSection(row.id)}
                className="flex h-11 items-center gap-2 px-3 text-left transition-colors hover:bg-secondary/60 md:px-4"
              >
                <span className="font-mono text-[10px] text-lime">{row.index}</span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                  {row.label}
                </span>
                {row.accent && row.value && (
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.accent }} aria-hidden />
                )}
                <span className={cn("whitespace-nowrap text-sm", row.value ? "text-off" : "text-muted-foreground/60")}>
                  {row.value ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center p-1.5">
          {room?.preparing ? (
            <span role="status" className="flex h-8 items-center whitespace-nowrap rounded-full border border-border px-4 text-sm text-muted-foreground">
              Förbereds
            </span>
          ) : room && dealer ? (
            <a
              href={playUrlFor({ operator, room, dealer })} onClick={prepareLaunch} onAuxClick={prepareLaunch}
              className="flex h-8 items-center gap-2 rounded-full bg-lime px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-85"
            >
              Spela
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => scrollToSection(nextId)}
              className="flex h-8 items-center gap-2 whitespace-nowrap rounded-full border border-border px-4 text-sm text-foreground transition-colors hover:border-lime"
            >
              {step === 2 ? "Välj spelbord" : "Välj dealer"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
