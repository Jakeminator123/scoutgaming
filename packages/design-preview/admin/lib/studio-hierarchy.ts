export type Level = "operator" | "game" | "room"

export type OperatorStatus = "active" | "paused"
export type Operator = { id: string; name: string; sharePct: number; status: OperatorStatus; license: string }
export type Game = { id: string; operatorId: string; name: string; kind: string }
export type Room = { id: string; gameId: string; name: string; seats: number }

export type Hierarchy = {
  operators: Operator[]
  games: Game[]
  rooms: Room[]
}

export const LEVEL_META: Record<Level | "dealer", { label: string; plural: string; placeholder: string }> = {
  operator: { label: "Spelbolag", plural: "Spelbolag", placeholder: "Nytt spelbolag" },
  game: { label: "Spel", plural: "Spel", placeholder: "Nytt spel" },
  room: { label: "Rum", plural: "Rum", placeholder: "Nytt rum" },
  dealer: { label: "Dealer", plural: "Dealers", placeholder: "Ny dealer" },
}

export const DEFAULT_SHARE_PCT = 12

export const seedHierarchy: Hierarchy = {
  operators: [
    { id: "nordic-bet", name: "Nordic Bet", sharePct: 12, status: "active", license: "SGA 23Si1042" },
    { id: "lucky-north", name: "Lucky North", sharePct: 15, status: "active", license: "MGA/B2C/381" },
  ],
  games: [
    { id: "nb-blackjack", operatorId: "nordic-bet", name: "Blackjack", kind: "blackjack" },
    { id: "nb-baccarat", operatorId: "nordic-bet", name: "Baccarat", kind: "baccarat" },
    { id: "ln-blackjack", operatorId: "lucky-north", name: "Blackjack", kind: "blackjack" },
  ],
  rooms: [
    { id: "nb-bj-classic", gameId: "nb-blackjack", name: "Classic 1", seats: 7 },
    { id: "nb-bj-vip", gameId: "nb-blackjack", name: "VIP Lounge", seats: 7 },
    { id: "nb-bac-1", gameId: "nb-baccarat", name: "Baccarat 1", seats: 7 },
    { id: "ln-bj-1", gameId: "ln-blackjack", name: "North Table", seats: 7 },
  ],
}
