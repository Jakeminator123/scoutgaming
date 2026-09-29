import { cn } from "@/lib/utils"
import { type Suit, SUIT_SYMBOL } from "@/lib/blackjack"

interface DecoCardProps {
  rank: string
  suit: Suit
  className?: string
}

export function DecoCard({ rank, suit, className }: DecoCardProps) {
  const red = suit === "hearts" || suit === "diamonds"
  const symbol = SUIT_SYMBOL[suit]
  return (
    <div aria-hidden="true" className={cn("@container w-full", className)}>
      <div
        className={cn(
          "relative aspect-[5/7] w-full rounded-[6cqw] bg-[#f6f1e7] p-[7cqw] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-black/20",
          red ? "text-[#a3262a]" : "text-[#1a1714]",
        )}
      >
        <div className="flex flex-col items-start font-serif leading-none">
          <span className="text-[22cqw] font-semibold">{rank}</span>
          <span className="text-[18cqw]">{symbol}</span>
        </div>
        <span className="absolute inset-0 flex items-center justify-center font-serif text-[48cqw]">{symbol}</span>
        <div className="absolute right-[7cqw] bottom-[7cqw] flex rotate-180 flex-col items-start font-serif leading-none">
          <span className="text-[22cqw] font-semibold">{rank}</span>
          <span className="text-[18cqw]">{symbol}</span>
        </div>
      </div>
    </div>
  )
}

export function DecoCardBack({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("@container w-full", className)}>
      <div className="relative aspect-[5/7] w-full rounded-[6cqw] border border-primary/50 bg-[#231d17] p-[7cqw] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="flex h-full w-full items-center justify-center rounded-[4cqw] border border-primary/40 bg-[repeating-linear-gradient(45deg,transparent_0_5px,rgba(200,164,106,0.14)_5px_6px)]">
          <span className="font-serif text-[28cqw] text-primary/80">A</span>
        </div>
      </div>
    </div>
  )
}

export function PitchCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("@container w-full", className)}>
      <div className="relative aspect-[5/7] w-full overflow-hidden rounded-[6cqw] bg-[#1f7a3a] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-black/30">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.05)_0_14%,transparent_14%_28%)]" />
        <div className="absolute inset-[6cqw] rounded-[1cqw] border-[1.5cqw] border-white/85" />
        <div className="absolute inset-x-[6cqw] top-1/2 h-[1.5cqw] -translate-y-1/2 bg-white/85" />
        <div className="absolute top-1/2 left-1/2 aspect-square w-[34cqw] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5cqw] border-white/85" />
        <div className="absolute top-[6cqw] left-1/2 h-[22cqw] w-[54cqw] -translate-x-1/2 border-[1.5cqw] border-t-0 border-white/85" />
        <div className="absolute bottom-[6cqw] left-1/2 h-[22cqw] w-[54cqw] -translate-x-1/2 border-[1.5cqw] border-b-0 border-white/85" />
        <div className="absolute top-[6cqw] left-1/2 h-[9cqw] w-[26cqw] -translate-x-1/2 border-[1.5cqw] border-t-0 border-white/85" />
        <div className="absolute bottom-[6cqw] left-1/2 h-[9cqw] w-[26cqw] -translate-x-1/2 border-[1.5cqw] border-b-0 border-white/85" />
        <span className="absolute right-[7cqw] bottom-[5cqw] font-mono text-[7cqw] font-bold tracking-widest text-lime">
          {"//FANTASY"}
        </span>
      </div>
    </div>
  )
}

const QUEENS = {
  spades: { video: "/videos/queen-spades.mp4", poster: "/images/queen-spades.jpg" },
  hearts: { video: "/videos/queen-hearts.mp4", poster: "/images/queen-hearts.jpg" },
} as const

/** A queen whose court portrait is a living croupier instead of a drawn figure. */
export function QueenCard({ suit, className }: { suit: keyof typeof QUEENS; className?: string }) {
  const red = suit === "hearts"
  const symbol = SUIT_SYMBOL[suit]
  const media = QUEENS[suit]
  return (
    <div aria-hidden="true" className={cn("@container w-full", className)}>
      <div
        className={cn(
          "relative aspect-[5/7] w-full overflow-hidden rounded-[6cqw] bg-[#f6f1e7] p-[7cqw] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-black/20",
          red ? "text-[#a3262a]" : "text-[#1a1714]",
        )}
      >
        <div className="absolute inset-x-[24cqw] top-[10cqw] bottom-[10cqw] overflow-hidden rounded-[2cqw] border-[0.8cqw] border-current/80 bg-ink">
          <video
            src={media.video}
            poster={media.poster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/40" />
        </div>
        <div className="absolute top-[7cqw] left-[6cqw] flex w-[14cqw] flex-col items-center font-serif leading-none">
          <span className="text-[15cqw] font-semibold">Q</span>
          <span className="text-[11cqw]">{symbol}</span>
        </div>
        <div className="absolute right-[6cqw] bottom-[7cqw] flex w-[14cqw] rotate-180 flex-col items-center font-serif leading-none">
          <span className="text-[15cqw] font-semibold">Q</span>
          <span className="text-[11cqw]">{symbol}</span>
        </div>
      </div>
    </div>
  )
}

export function Football({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("w-full", className)}>
      <svg viewBox="0 0 100 100" className="aspect-square w-full drop-shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
        <defs>
          <radialGradient id="ball-shade" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#e6e6e6" />
            <stop offset="100%" stopColor="#9a9a9a" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#ball-shade)" stroke="#2a2a2a" strokeWidth="1.5" />
        <polygon points="50,33 66,45 60,64 40,64 34,45" fill="#161616" />
        <polygon points="50,2 62,10 58,24 42,24 38,10" fill="#161616" />
        <polygon points="96,40 98,54 88,66 78,58 82,44" fill="#161616" />
        <polygon points="4,40 18,44 22,58 12,66 2,54" fill="#161616" />
        <polygon points="72,94 58,96 54,84 66,76 78,84" fill="#161616" />
        <polygon points="28,94 22,84 34,76 46,84 42,96" fill="#161616" />
        <g stroke="#161616" strokeWidth="1.8" fill="none">
          <line x1="50" y1="33" x2="50" y2="24" />
          <line x1="66" y1="45" x2="82" y2="44" />
          <line x1="60" y1="64" x2="66" y2="76" />
          <line x1="40" y1="64" x2="34" y2="76" />
          <line x1="34" y1="45" x2="18" y2="44" />
        </g>
      </svg>
    </div>
  )
}

/** The white poker dealer puck. */
export function DealerButton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("@container w-full", className)}>
      <div className="relative aspect-square w-full rounded-full bg-[#f6f1e7] shadow-[0_16px_40px_rgba(0,0,0,0.6)] ring-1 ring-black/30">
        <div className="absolute inset-[7%] rounded-full border-[2.5cqw] border-[#1a1714]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[15cqw] font-black tracking-[0.06em] text-[#1a1714] uppercase">Dealer</span>
        </div>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(255,255,255,0.75),transparent_50%)]" />
      </div>
    </div>
  )
}

const CHIP_STYLES: Record<number, { ring: string; face: string; text: string }> = {
  10: { ring: "bg-[#e9e2d3]", face: "bg-[#f6f1e7]", text: "text-[#1a1714]" },
  25: { ring: "bg-[#b8925a]", face: "bg-[#c8a46a]", text: "text-[#1a1714]" },
  100: { ring: "bg-[#0d0b09]", face: "bg-[#1a1714]", text: "text-[#c8a46a]" },
  500: { ring: "bg-[#6e1c20]", face: "bg-[#8a2429]", text: "text-[#f6f1e7]" },
}

export function Chip({ value, className }: { value: 10 | 25 | 100 | 500; className?: string }) {
  const s = CHIP_STYLES[value]
  return (
    <div aria-hidden="true" className={cn("@container w-full", className)}>
      <div className={cn("relative aspect-square w-full rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.6)]", s.ring)}>
        <div className="absolute inset-[6%] rounded-full border-[3cqw] border-dashed border-white/70" />
        <div className={cn("absolute inset-[22%] flex items-center justify-center rounded-full", s.face, s.text)}>
          <span className="font-serif text-[26cqw] leading-none font-semibold">{value}</span>
        </div>
      </div>
    </div>
  )
}
