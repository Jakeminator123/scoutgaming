import type { CSSProperties } from "react"

interface Trail {
  d: string
  width: number
  dur: number
  delay: number
  dash: number
  gap: number
  gradient: "lime" | "steel" | "gold"
}

const TRAILS: Trail[] = [
  { d: "M -200 980 C 300 700, 500 900, 900 520 S 1500 180, 1900 -80", width: 3, dur: 28, delay: -6, dash: 420, gap: 1700, gradient: "lime" },
  { d: "M -200 800 C 250 640, 450 760, 850 420 S 1400 120, 1900 -160", width: 2, dur: 34, delay: -18, dash: 300, gap: 1900, gradient: "steel" },
  { d: "M -200 1120 C 350 880, 650 1000, 1000 640 S 1550 320, 1900 60", width: 4, dur: 40, delay: -11, dash: 520, gap: 1800, gradient: "gold" },
  { d: "M -200 660 C 200 560, 500 640, 800 340 S 1350 20, 1900 -240", width: 1.5, dur: 31, delay: -26, dash: 260, gap: 2100, gradient: "lime" },
  { d: "M -200 1260 C 400 1000, 700 1140, 1100 760 S 1600 440, 1900 200", width: 2.5, dur: 37, delay: -3, dash: 380, gap: 1900, gradient: "steel" },
]

export function LightTrails() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-30"
      viewBox="0 0 1600 900"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="trail-lime" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d6ff3a" stopOpacity="0" />
          <stop offset="0.5" stopColor="#d6ff3a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#b5dc1f" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trail-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5a6470" stopOpacity="0" />
          <stop offset="0.5" stopColor="#8a97a6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#5a6470" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trail-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c8a46a" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c8a46a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#c8a46a" stopOpacity="0" />
        </linearGradient>
        <filter id="trail-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {TRAILS.map((t, i) => (
        <g key={i}>
          <path
            d={t.d}
            fill="none"
            stroke={`url(#trail-${t.gradient})`}
            strokeWidth={t.width * 5}
            strokeLinecap="round"
            filter="url(#trail-blur)"
            className="animate-trail"
            style={
              {
                "--dur": `${t.dur}s`,
                "--delay": `${t.delay}s`,
                "--dash": t.dash,
                "--gap": t.gap,
              } as CSSProperties
            }
          />
          <path
            d={t.d}
            fill="none"
            stroke={`url(#trail-${t.gradient})`}
            strokeWidth={t.width}
            strokeLinecap="round"
            className="animate-trail"
            style={
              {
                "--dur": `${t.dur}s`,
                "--delay": `${t.delay}s`,
                "--dash": t.dash,
                "--gap": t.gap,
              } as CSSProperties
            }
          />
        </g>
      ))}
    </svg>
  )
}
