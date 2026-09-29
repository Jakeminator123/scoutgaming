import { cn } from "@/lib/utils"
import { type Card, SUIT_NAME, SUIT_SYMBOL } from "@/lib/blackjack"

interface PlayingCardProps {
  card?: Card
  hidden?: boolean
  className?: string
}

export function PlayingCard({ card, hidden, className }: PlayingCardProps) {
  const base =
    "relative aspect-[5/7] w-[12cqw] max-w-24 shrink-0 rounded-[0.6cqw] shadow-[0_6px_18px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-top-6 duration-500"

  if (hidden || !card) {
    return (
      <div
        role="img"
        aria-label="Dolt kort"
        className={cn(base, "border border-primary/40 bg-[#231d17] p-[0.8cqw]", className)}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[0.4cqw] border border-primary/30 bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgba(200,164,106,0.12)_4px_5px)]">
          <span className="font-serif text-[3cqw] text-primary/70">A</span>
        </div>
      </div>
    )
  }

  const red = card.suit === "hearts" || card.suit === "diamonds"
  const symbol = SUIT_SYMBOL[card.suit]

  return (
    <div
      role="img"
      aria-label={`${card.rank} ${SUIT_NAME[card.suit]}`}
      className={cn(base, "bg-[#f6f1e7] p-[0.7cqw]", red ? "text-[#a3262a]" : "text-[#1a1714]", className)}
    >
      <div className="flex flex-col items-start font-serif leading-none" aria-hidden="true">
        <span className="text-[2.6cqw] font-semibold">{card.rank}</span>
        <span className="text-[2.2cqw]">{symbol}</span>
      </div>
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center font-serif text-[5.5cqw]"
      >
        {symbol}
      </span>
      <div
        className="absolute right-[0.7cqw] bottom-[0.7cqw] flex rotate-180 flex-col items-start font-serif leading-none"
        aria-hidden="true"
      >
        <span className="text-[2.6cqw] font-semibold">{card.rank}</span>
        <span className="text-[2.2cqw]">{symbol}</span>
      </div>
    </div>
  )
}
