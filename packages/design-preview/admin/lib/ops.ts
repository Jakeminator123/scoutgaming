import type { Dealer, StudioSnapshot } from "@/lib/studio-assets"
import type { Game, Room } from "@/lib/studio-hierarchy"

export type AccessLevel = 1 | 2 | 3

export const ACCESS_LEVELS: Record<AccessLevel, { label: string; hint: string }> = {
  1: { label: "Nivå 1", hint: "Full administration, avtal och radering" },
  2: { label: "Nivå 2", hint: "Drift och studio, läsrätt på ekonomi" },
  3: { label: "Nivå 3", hint: "Endast studio" },
}

export type TermScope = "game" | "dealer"
export type RevenueTerm = { id: string; operatorId: string; scope: TermScope; targetId: string; pct: number }

export type AuditCategory = "Struktur" | "Avtal" | "Åtkomst" | "API" | "AI" | "Integritet"
export type AuditEntry = { id: string; at: string; actor: string; category: AuditCategory; action: string; reason?: string }

export const CURRENT_USER = "Jakob L."

export const seedTerms: RevenueTerm[] = [
  { id: "t-nb-bac", operatorId: "nordic-bet", scope: "game", targetId: "nb-baccarat", pct: 10 },
  { id: "t-nb-vera", operatorId: "nordic-bet", scope: "dealer", targetId: "nb-bj-vip-vera", pct: 18 },
]

export const seedAudit: AuditEntry[] = [
  { id: "a3", at: "2026-10-09T14:12", actor: "Jakob L.", category: "Avtal", action: "Vera (Nordic Bet): andel 15 % → 18 %", reason: "Kändisavtal tecknat" },
  { id: "a2", at: "2026-10-04T09:40", actor: "Sara K.", category: "Åtkomst", action: "Mattias B. nivå 3 → nivå 2", reason: "Ny driftansvarig" },
  { id: "a1", at: "2026-09-28T16:05", actor: "Jakob L.", category: "Struktur", action: "La till spelbolag Lucky North" },
]

export const formatAt = (iso: string) => iso.slice(0, 16).replace("T", " ")
export const nowIso = () => new Date().toISOString().slice(0, 16)

export const formatSek = (value: number) => {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? "−" : ""
  return `${sign}${Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`
}

export const formatCompactSek = (value: number) =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1).replace(".", ",")} mkr` : `${Math.round(value / 1000)} tkr`

export function seeded(key: string) {
  let hash = 2166136261
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return (hash >>> 0) / 4294967296
}

const DAYS = 30
const LAST_DAY_UTC = Date.UTC(2026, 9, 11)

export const DAY_LABELS = Array.from({ length: DAYS }, (_, index) => {
  const date = new Date(LAST_DAY_UTC - (DAYS - 1 - index) * 86_400_000)
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`
})

const dailyGgr = (dealer: Dealer, day: number) => {
  const date = new Date(LAST_DAY_UTC - (DAYS - 1 - day) * 86_400_000)
  const weekend = [0, 5, 6].includes(date.getUTCDay()) ? 1.35 : 1
  const star = dealer.kind === "celebrity" ? 1.9 : 1
  return 16_000 * weekend * star * (0.65 + 0.7 * seeded(`${dealer.id}:${day}`))
}

export function effectiveTerm(terms: RevenueTerm[], operatorBase: number, gameId: string, dealerId: string) {
  const dealerTerm = terms.find((term) => term.scope === "dealer" && term.targetId === dealerId)
  if (dealerTerm) return { pct: dealerTerm.pct, source: "dealer" as const }
  const gameTerm = terms.find((term) => term.scope === "game" && term.targetId === gameId)
  if (gameTerm) return { pct: gameTerm.pct, source: "game" as const }
  return { pct: operatorBase, source: "operator" as const }
}

export type DealerEconomy = {
  dealer: Dealer
  room: Room
  game: Game
  operatorId: string
  pct: number
  source: "operator" | "game" | "dealer"
  ggr: number
  take: number
  payout: number
  net: number
  daily: number[]
}

export function computeEconomy(snapshot: StudioSnapshot, terms: RevenueTerm[]) {
  const rows: DealerEconomy[] = []
  for (const dealer of snapshot.dealers) {
    const room = snapshot.rooms.find((item) => item.id === dealer.roomId)
    const game = snapshot.games.find((item) => item.id === room?.gameId)
    const operator = snapshot.operators.find((item) => item.id === game?.operatorId)
    if (!room || !game || !operator) continue
    const term = effectiveTerm(terms, operator.sharePct, game.id, dealer.id)
    const live = operator.status === "active"
    const dailyGgrList = Array.from({ length: DAYS }, (_, day) => (live || day < DAYS - 3 ? dailyGgr(dealer, day) : 0))
    const daily = dailyGgrList.map((value) => value * (term.pct / 100) - value * (dealer.revsharePct / 100))
    const ggr = dailyGgrList.reduce((sum, value) => sum + value, 0)
    const take = ggr * (term.pct / 100)
    const payout = ggr * (dealer.revsharePct / 100)
    rows.push({ dealer, room, game, operatorId: operator.id, ...term, ggr, take, payout, net: take - payout, daily })
  }
  return rows
}

export type ServiceStatus = "up" | "degraded" | "down"

export const STATUS_META: Record<ServiceStatus, { label: string; dot: string; text: string }> = {
  up: { label: "Uppe", dot: "bg-sg-lime", text: "text-sg-lime" },
  degraded: { label: "Störd", dot: "bg-sg-amber", text: "text-sg-amber" },
  down: { label: "Nere", dot: "bg-sg-red", text: "text-sg-red" },
}

export type Service = {
  id: string
  name: string
  group: "Render" | "Ström" | "Spel" | "Data"
  status: ServiceStatus
  latencyMs: number
  uptime: number
  note: string
}

export const SERVICES: Service[] = [
  { id: "render-eu-1", name: "render-eu-1", group: "Render", status: "up", latencyMs: 38, uptime: 99.98, note: "8 GPU · 61 % last" },
  { id: "render-eu-2", name: "render-eu-2", group: "Render", status: "degraded", latencyMs: 142, uptime: 99.41, note: "Kö på klippbyten sedan 13:52" },
  { id: "stream-sfu", name: "Ström (WebRTC SFU)", group: "Ström", status: "up", latencyMs: 210, uptime: 99.95, note: "Glas-till-glas, p95" },
  { id: "game-api", name: "Spel-API", group: "Spel", status: "up", latencyMs: 24, uptime: 99.99, note: "v2.14 · 3 repliker" },
  { id: "openclaw", name: "OpenClaw dealer-agent", group: "Spel", status: "up", latencyMs: 640, uptime: 99.9, note: "Repliker och klippval" },
  { id: "journal-db", name: "Journal-databas", group: "Data", status: "up", latencyMs: 6, uptime: 100, note: "WORM-lagring, 7 års retention" },
  { id: "payments", name: "Avräkning & betalning", group: "Data", status: "up", latencyMs: 88, uptime: 99.97, note: "Nästa körning 1/11" },
]

export type Rng = { id: string; name: string; gameKinds: string[]; status: ServiceStatus; cert: string; certUntil: string; lastSelfTest: string }

export const RNGS: Rng[] = [
  { id: "rng-shoe", name: "RNG · sko (6 lekar)", gameKinds: ["blackjack"], status: "up", cert: "GLI-19", certUntil: "2027-03-31", lastSelfTest: "13:58" },
  { id: "rng-baccarat", name: "RNG · baccarat (8 lekar)", gameKinds: ["baccarat"], status: "up", cert: "GLI-19", certUntil: "2026-11-15", lastSelfTest: "13:58" },
  { id: "rng-generic", name: "RNG · generisk", gameKinds: [], status: "up", cert: "iTech Labs", certUntil: "2027-06-30", lastSelfTest: "13:57" },
]

export const rngForGame = (kind: string) => RNGS.find((rng) => rng.gameKinds.includes(kind)) ?? RNGS[RNGS.length - 1]

export const renderNodeForRoom = (roomId: string) => (seeded(roomId) < 0.5 ? SERVICES[0] : SERVICES[1])

export const uptimeTicks = (serviceId: string, status: ServiceStatus) =>
  Array.from({ length: 30 }, (_, index) => {
    if (index === 29) return status
    const roll = seeded(`${serviceId}:tick:${index}`)
    return roll > 0.97 ? "degraded" : "up"
  }) as ServiceStatus[]

export const INCIDENTS = [
  { id: "i2", at: "2026-10-12T13:52", status: "degraded" as ServiceStatus, title: "render-eu-2: förhöjd latens på klippbyten", body: "Rum på noden visar Störd. Övriga rum påverkas inte." },
  { id: "i1", at: "2026-10-07T02:10", status: "up" as ServiceStatus, title: "Löst: Ström, 4 min avbrott", body: "SFU startades om efter certifikatsbyte." },
]

export const CERT_WARNING_BEFORE = "2026-12-12"
