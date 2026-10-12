"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const POCKET = 360 / ORDER.length;

const C = 100;
const R_RIM = 97;
const R_OUTER = 92;
const R_INNER = 64;
const R_TEXT = 79;
const R_TRACK = 86;
const R_POCKET = 72;

const IDLE_WHEEL = 8;
const IDLE_BALL = -70;
const MIN_GAP = 18_000;
const MAX_GAP = 30_000;

type PocketColor = "zero" | "red" | "black";
type Result = { number: number; color: PocketColor };
type Phase = "idle" | "spinning" | "locked";

function polar(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

function wedgePath(k: number) {
  const a0 = k * POCKET - POCKET / 2;
  const a1 = k * POCKET + POCKET / 2;
  const o0 = polar(R_OUTER, a0);
  const o1 = polar(R_OUTER, a1);
  const i1 = polar(R_INNER, a1);
  const i0 = polar(R_INNER, a0);
  return `M${o0.x} ${o0.y} A${R_OUTER} ${R_OUTER} 0 0 1 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A${R_INNER} ${R_INNER} 0 0 0 ${i0.x} ${i0.y} Z`;
}

function colorOf(n: number): PocketColor {
  if (n === 0) return "zero";
  return REDS.has(n) ? "red" : "black";
}

const FILL: Record<PocketColor, string> = {
  zero: "#d6ff3a",
  red: "#a8322f",
  black: "#17191d",
};

const COLOR_LABEL: Record<PocketColor, string> = {
  zero: "Noll",
  red: "Rött",
  black: "Svart",
};

export function RouletteWheel({ className }: { className?: string }) {
  const wheelRef = useRef<SVGGElement>(null);
  const ballRef = useRef<SVGCircleElement>(null);
  const spinRequests = useRef(0);
  const [result, setResult] = useState<Result | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    let wheelAngle = 0;
    let wheelVel = IDLE_WHEEL;
    let ballAngle = 180;
    let ballVel = IDLE_BALL;
    let ballR = R_TRACK;

    let mode: "idle" | "spin" | "settle" | "locked" = "idle";
    let handled = spinRequests.current;
    let nextAuto = performance.now() + 5_000 + Math.random() * 5_000;

    let targetRel = 0;
    let settleStart = 0;
    let settleFrom = 0;
    let settleFromR = R_TRACK;
    let settleWheel0 = 0;
    let settleDelta = 0;
    let pending: Result | null = null;

    const startSpin = () => {
      mode = "spin";
      wheelVel = 220 + Math.random() * 80;
      ballVel = -(760 + Math.random() * 200);
      ballR = R_TRACK;
      setPhase("spinning");
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const spinInProgress = mode === "spin" || mode === "settle";
      if (spinRequests.current !== handled) {
        handled = spinRequests.current;
        if (!spinInProgress) startSpin();
      } else if (!spinInProgress && now >= nextAuto) {
        startSpin();
      }

      if (mode === "spin") {
        wheelVel = Math.max(IDLE_WHEEL, wheelVel - wheelVel * 0.45 * dt);
        ballVel -= ballVel * 0.6 * dt;
        wheelAngle += wheelVel * dt;
        ballAngle += ballVel * dt;

        if (Math.abs(ballVel) < 110) {
          const k = Math.floor(Math.random() * ORDER.length);
          targetRel = k * POCKET;
          pending = { number: ORDER[k], color: colorOf(ORDER[k]) };
          mode = "settle";
          settleStart = now;
          settleFrom = ballAngle;
          settleFromR = ballR;
          settleWheel0 = wheelAngle;
          const toTarget = (((settleWheel0 + targetRel - settleFrom) % 360) + 360) % 360;
          settleDelta = toTarget - 720;
        }
      } else if (mode === "settle") {
        wheelVel = Math.max(IDLE_WHEEL, wheelVel - wheelVel * 0.45 * dt);
        wheelAngle += wheelVel * dt;
        const t = Math.min(1, (now - settleStart) / 1500);
        const e = 1 - Math.pow(1 - t, 3);
        ballAngle = settleFrom + settleDelta * e + (wheelAngle - settleWheel0) * e;
        ballR = settleFromR + (R_POCKET - settleFromR) * e;

        if (t >= 1) {
          mode = "locked";
          setResult(pending);
          setPhase("locked");
          nextAuto = now + MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
        }
      } else {
        wheelVel = IDLE_WHEEL;
        wheelAngle += wheelVel * dt;
        if (mode === "locked") {
          ballAngle = wheelAngle + targetRel;
          ballR = R_POCKET;
        } else {
          ballAngle += IDLE_BALL * dt;
          ballR = R_TRACK;
        }
      }

      if (wheelRef.current) {
        wheelRef.current.setAttribute("transform", `rotate(${wheelAngle} ${C} ${C})`);
      }
      if (ballRef.current) {
        const p = polar(ballR, ballAngle);
        ballRef.current.setAttribute("cx", p.x.toFixed(2));
        ballRef.current.setAttribute("cy", p.y.toFixed(2));
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const requestSpin = () => {
    spinRequests.current += 1;
  };

  const start = polar(R_TRACK, 180);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <button
        type="button"
        onClick={requestSpin}
        aria-label={result ? `Snurra hjulet igen. Senaste nummer ${result.number}, ${COLOR_LABEL[result.color]}` : "Snurra hjulet"}
        className="group relative aspect-square w-full max-w-[220px] rounded-full outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]" aria-hidden>
          <circle cx={C} cy={C} r={R_RIM} fill="oklch(12% 0.01 70)" stroke="var(--scout-brass)" strokeWidth={1.4} />
          <circle cx={C} cy={C} r={R_OUTER + 1.5} fill="none" stroke="oklch(22% 0.012 70)" strokeWidth={3} />

          <g ref={wheelRef}>
            {ORDER.map((n, k) => (
              <path key={n} d={wedgePath(k)} fill={FILL[colorOf(n)]} stroke="oklch(12% 0.01 70)" strokeWidth={0.6} />
            ))}
            {ORDER.map((n, k) => {
              const p = polar(R_TEXT, k * POCKET);
              return (
                <text
                  key={n}
                  x={p.x}
                  y={p.y}
                  transform={`rotate(${k * POCKET} ${p.x} ${p.y})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={6.2}
                  fontFamily="var(--font-geist-mono), ui-monospace, monospace"
                  fill={n === 0 ? "#0a0b0d" : "#f2f1ed"}
                  fillOpacity={0.92}
                >
                  {n}
                </text>
              );
            })}
            <circle cx={C} cy={C} r={R_INNER - 1.5} fill="oklch(17% 0.01 70)" stroke="var(--scout-brass)" strokeWidth={1} />
            <circle cx={C} cy={C} r={32} fill="oklch(21% 0.012 70)" stroke="var(--scout-brass)" strokeWidth={0.8} />
            {[0, 90, 180, 270].map((a) => {
              const p1 = polar(31, a);
              const p2 = polar(50, a);
              return (
                <line
                  key={a}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="var(--scout-brass)"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              );
            })}
            <circle cx={C} cy={C} r={5.5} fill="var(--scout-brass)" />
          </g>

          <circle ref={ballRef} cx={start.x} cy={start.y} r={3.2} fill="#f2f1ed" />
        </svg>

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-off opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            Snurra
          </span>
        </span>
      </button>

      <div className="flex h-9 items-center gap-3" aria-live="polite">
        {result ? (
          <>
            <span
              key={`${result.number}-${phase}`}
              className={cn(
                "display flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xl animate-result-pop",
                result.color === "zero" ? "bg-lime text-ink" : result.color === "red" ? "bg-[#a8322f] text-off" : "bg-[#17191d] text-off",
                phase === "spinning" && "opacity-40",
              )}
            >
              {result.number}
            </span>
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {phase === "spinning" ? "Snurrar…" : COLOR_LABEL[result.color]}
            </span>
          </>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {phase === "spinning" ? "Snurrar…" : "Kulan rullar"}
          </span>
        )}
      </div>
    </div>
  );
}
