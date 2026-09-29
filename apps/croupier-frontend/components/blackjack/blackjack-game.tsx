"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { PlayingCard } from "@/components/blackjack/playing-card"
import { cn } from "@/lib/utils"
import {
  type Card,
  type Outcome,
  OUTCOME_LINE,
  RESHUFFLE_THRESHOLD,
  createShoe,
  handValue,
  isBlackjack,
  payoutFor,
  playDealer,
  resolveOutcome,
} from "@/lib/blackjack"

type Phase = "betting" | "player" | "done"

interface GameState {
  shoe: Card[]
  player: Card[]
  dealer: Card[]
  balance: number
  bet: number
  lastBet: number
  phase: Phase
  outcome: Outcome | null
  payout: number
}

const STARTING_BALANCE = 1000
const CHIPS = [10, 25, 100, 500] as const

const initialState: GameState = {
  shoe: [],
  player: [],
  dealer: [],
  balance: STARTING_BALANCE,
  bet: 0,
  lastBet: 0,
  phase: "betting",
  outcome: null,
  payout: 0,
}

function finishRound(state: GameState, player: Card[], dealer: Card[], shoe: Card[], bet: number): GameState {
  const outcome = resolveOutcome(player, dealer)
  const payout = payoutFor(outcome, bet)
  return {
    ...state,
    shoe,
    player,
    dealer,
    bet,
    phase: "done",
    outcome,
    payout,
    balance: state.balance + payout,
  }
}

function standWith(state: GameState, player: Card[], shoe: Card[], bet: number): GameState {
  if (handValue(player).total > 21) return finishRound(state, player, state.dealer, shoe, bet)
  const result = playDealer(state.dealer, shoe)
  return finishRound(state, player, result.dealer, result.shoe, bet)
}

function formatChips(value: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(value)
}

export function BlackjackGame() {
  const [state, setState] = useState<GameState>(initialState)
  const { player, dealer, phase, bet, balance, outcome } = state

  const playerValue = handValue(player)
  const dealerVisible = phase === "player" ? dealer.slice(0, 1) : dealer
  const dealerValue = handValue(dealerVisible)
  const canDouble = phase === "player" && player.length === 2 && balance >= bet

  function addChip(value: number) {
    setState((s) => (s.phase === "betting" && s.bet + value <= s.balance ? { ...s, bet: s.bet + value } : s))
  }

  function clearBet() {
    setState((s) => (s.phase === "betting" ? { ...s, bet: 0 } : s))
  }

  function deal() {
    setState((s) => {
      if (s.phase !== "betting" || s.bet <= 0 || s.bet > s.balance) return s
      const shoe = s.shoe.length < RESHUFFLE_THRESHOLD ? createShoe() : [...s.shoe]
      const p1 = shoe.pop()!
      const d1 = shoe.pop()!
      const p2 = shoe.pop()!
      const d2 = shoe.pop()!
      const next: GameState = {
        ...s,
        shoe,
        player: [p1, p2],
        dealer: [d1, d2],
        balance: s.balance - s.bet,
        lastBet: s.bet,
        phase: "player",
        outcome: null,
        payout: 0,
      }
      if (isBlackjack(next.player) || isBlackjack(next.dealer)) {
        return finishRound(next, next.player, next.dealer, shoe, s.bet)
      }
      return next
    })
  }

  function hit() {
    setState((s) => {
      if (s.phase !== "player") return s
      const shoe = [...s.shoe]
      const player = [...s.player, shoe.pop()!]
      const total = handValue(player).total
      if (total > 21) return finishRound(s, player, s.dealer, shoe, s.bet)
      if (total === 21) return standWith(s, player, shoe, s.bet)
      return { ...s, shoe, player }
    })
  }

  function stand() {
    setState((s) => (s.phase === "player" ? standWith(s, s.player, s.shoe, s.bet) : s))
  }

  function doubleDown() {
    setState((s) => {
      if (s.phase !== "player" || s.player.length !== 2 || s.balance < s.bet) return s
      const shoe = [...s.shoe]
      const player = [...s.player, shoe.pop()!]
      const doubled = { ...s, balance: s.balance - s.bet }
      return standWith(doubled, player, shoe, s.bet * 2)
    })
  }

  function newRound() {
    setState((s) => ({
      ...s,
      player: [],
      dealer: [],
      phase: "betting",
      outcome: null,
      payout: 0,
      bet: s.lastBet <= s.balance ? s.lastBet : 0,
    }))
  }

  function refill() {
    setState((s) => ({ ...initialState, shoe: s.shoe }))
  }

  const astridLine =
    phase === "betting"
      ? balance <= 0
        ? "Dina demomarker är slut. Vill du fylla på?"
        : "Välkommen till mitt bord. Placera din insats."
      : phase === "player"
        ? `Du har ${playerValue.soft && playerValue.total < 21 ? `mjuk ${playerValue.total}` : playerValue.total}. Kort eller stanna?`
        : outcome
          ? OUTCOME_LINE[outcome]
          : ""

  const won = outcome === "blackjack" || outcome === "win" || outcome === "dealer-bust"

  return (
    <div className="flex w-full flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
      <section
        aria-label="Blackjackbord"
        className="@container relative aspect-[9/16] w-full max-w-[min(100%,calc((100svh-6rem)*0.5625))] overflow-hidden rounded-lg border border-border bg-[#1f1b18]"
      >
        <Image
          src="/images/astrid-table.png"
          alt="Astrid, croupier i svart kavaj, vid ett blackjackbord"
          fill
          priority
          sizes="(min-width: 1024px) 540px, 100vw"
          className="object-cover"
        />

        <div className="absolute inset-x-0 top-[53%] flex flex-col items-center gap-[1.5cqw]">
          <HandLabel label="Astrid" value={dealer.length ? dealerValue.total : null} />
          <div className="flex min-h-[17cqw] justify-center -space-x-[4cqw]">
            {dealer.map((card, i) => (
              <PlayingCard key={card.id + i} card={card} hidden={phase === "player" && i === 1} />
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 top-[71%] flex flex-col items-center gap-[1.5cqw]">
          <div className="flex min-h-[17cqw] justify-center -space-x-[4cqw]">
            {player.map((card, i) => (
              <PlayingCard key={card.id + i} card={card} />
            ))}
          </div>
          <HandLabel label="Du" value={player.length ? playerValue.total : null} />
        </div>

        <div className="absolute inset-x-[8%] top-[4%] rounded-md border border-primary/25 bg-background/70 px-[3cqw] py-[2cqw] backdrop-blur-sm">
          <p className="font-mono text-[2.2cqw] tracking-[0.2em] text-primary uppercase">{"// Astrid"}</p>
          <p aria-live="polite" className="mt-[0.5cqw] font-serif text-[4cqw] leading-tight text-foreground text-balance">
            {astridLine}
          </p>
        </div>
      </section>

      <aside
        aria-label="Kontroller"
        className="flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-card p-6 lg:sticky lg:top-24"
      >
        <dl className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">Saldo</dt>
            <dd className="font-serif text-3xl text-foreground">{formatChips(balance)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">Insats</dt>
            <dd className="font-serif text-3xl text-primary">{formatChips(bet)}</dd>
          </div>
        </dl>

        {phase === "done" && outcome && (
          <p
            className={cn(
              "rounded-md border px-4 py-3 font-mono text-sm",
              won ? "border-accent/50 text-accent" : "border-border text-muted-foreground",
            )}
          >
            {state.payout > 0 ? `+${formatChips(state.payout)} marker tillbaka` : `-${formatChips(bet)} marker`}
          </p>
        )}

        {phase === "betting" && (
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">{"// Välj marker"}</p>
            <div className="grid grid-cols-4 gap-3">
              {CHIPS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => addChip(value)}
                  disabled={bet + value > balance}
                  aria-label={`Lägg till ${value} marker`}
                  className="flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-primary/60 bg-secondary font-mono text-sm text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={clearBet}
                disabled={bet === 0}
                className="flex-1 bg-transparent font-mono text-xs tracking-widest uppercase"
              >
                Rensa
              </Button>
              <Button
                onClick={deal}
                disabled={bet === 0}
                className="flex-[2] font-mono text-xs tracking-widest uppercase"
              >
                Dela ut
              </Button>
            </div>
            {balance <= 0 && (
              <Button variant="secondary" onClick={refill} className="font-mono text-xs tracking-widest uppercase">
                Fyll på 1 000 demomarker
              </Button>
            )}
          </div>
        )}

        {phase === "player" && (
          <div className="grid grid-cols-3 gap-3">
            <Button onClick={hit} className="font-mono text-xs tracking-widest uppercase">
              Kort
            </Button>
            <Button variant="outline" onClick={stand} className="bg-transparent font-mono text-xs tracking-widest uppercase">
              Stanna
            </Button>
            <Button
              variant="secondary"
              onClick={doubleDown}
              disabled={!canDouble}
              className="font-mono text-xs tracking-widest uppercase"
            >
              Dubbla
            </Button>
          </div>
        )}

        {phase === "done" && (
          <Button onClick={newRound} className="font-mono text-xs tracking-widest uppercase">
            Ny hand
          </Button>
        )}

        <ul className="flex flex-col gap-2 border-t border-border pt-5 font-mono text-xs leading-relaxed text-muted-foreground">
          <li>Blackjack betalar 3 till 2</li>
          <li>Dealern stannar på alla 17</li>
          <li>{"6 kortlekar i skon, blandas vid < 60 kort"}</li>
          <li>Endast demomarker, inga riktiga pengar</li>
        </ul>
      </aside>
    </div>
  )
}

function HandLabel({ label, value }: { label: string; value: number | null }) {
  return (
    <p className="rounded-full border border-primary/30 bg-background/70 px-[2.5cqw] py-[0.6cqw] font-mono text-[2.2cqw] tracking-[0.2em] text-foreground uppercase backdrop-blur-sm">
      {label}
      {value !== null && <span className="ml-[1.5cqw] text-primary">{value}</span>}
    </p>
  )
}
