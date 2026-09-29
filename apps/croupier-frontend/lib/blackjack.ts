export type Suit = "spades" | "hearts" | "diamonds" | "clubs"
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K"

export interface Card {
  id: string
  rank: Rank
  suit: Suit
}

export type Outcome = "blackjack" | "win" | "dealer-bust" | "push" | "lose" | "bust" | "dealer-blackjack"

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"]
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "\u2660",
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
}

export const SUIT_NAME: Record<Suit, string> = {
  spades: "spader",
  hearts: "hjärter",
  diamonds: "ruter",
  clubs: "klöver",
}

export const DECKS_IN_SHOE = 6
export const RESHUFFLE_THRESHOLD = 60

export function createShoe(decks = DECKS_IN_SHOE): Card[] {
  const shoe: Card[] = []
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ id: `${d}-${suit}-${rank}`, rank, suit })
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shoe[i], shoe[j]] = [shoe[j], shoe[i]]
  }
  return shoe
}

function cardPoints(rank: Rank): number {
  if (rank === "A") return 11
  if (rank === "J" || rank === "Q" || rank === "K") return 10
  return Number(rank)
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += cardPoints(card.rank)
    if (card.rank === "A") aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21
}

/** Dealer stands on all 17s, including soft 17. */
export function playDealer(dealer: Card[], shoe: Card[]): { dealer: Card[]; shoe: Card[] } {
  const hand = [...dealer]
  const rest = [...shoe]
  while (handValue(hand).total < 17) {
    const card = rest.pop()
    if (!card) break
    hand.push(card)
  }
  return { dealer: hand, shoe: rest }
}

export function resolveOutcome(player: Card[], dealer: Card[]): Outcome {
  const p = handValue(player).total
  const d = handValue(dealer).total
  const playerBJ = isBlackjack(player)
  const dealerBJ = isBlackjack(dealer)

  if (playerBJ && dealerBJ) return "push"
  if (playerBJ) return "blackjack"
  if (dealerBJ) return "dealer-blackjack"
  if (p > 21) return "bust"
  if (d > 21) return "dealer-bust"
  if (p > d) return "win"
  if (p === d) return "push"
  return "lose"
}

/** Total amount returned to the player (stake included). */
export function payoutFor(outcome: Outcome, bet: number): number {
  switch (outcome) {
    case "blackjack":
      return bet + bet * 1.5
    case "win":
    case "dealer-bust":
      return bet * 2
    case "push":
      return bet
    default:
      return 0
  }
}

export const OUTCOME_LINE: Record<Outcome, string> = {
  blackjack: "Blackjack. Vackert spelat.",
  win: "Grattis, handen är din.",
  "dealer-bust": "Jag gick över 21. Du vinner.",
  push: "Oavgjort. Du får tillbaka din insats.",
  lose: "Banken vinner den här gången.",
  bust: "Över 21. Tyvärr.",
  "dealer-blackjack": "Jag har blackjack. Bättre lycka nästa hand.",
}
