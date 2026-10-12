import type { Edge, Node } from "@xyflow/react"

export type ClipGroup = "idle" | "transition" | "deal" | "reveal" | "speech" | "custom"
export type Pose = "VILA" | "REDO"
export type Requirement = "required" | "recommended" | "optional"
export type Trigger = "original" | "auto" | "openclaw"

export type ClipVariant = {
  id: string
  name: string
  trigger: Trigger
  condition?: string
  hasFile: boolean
  line?: string
}

export type ClipNodeData = {
  step: string
  group: ClipGroup
  title: string
  slotKey: string
  from: Pose
  to: Pose
  durationSec: string
  format: string
  requirement: Requirement
  description: string
  thumbnail?: string
  videoUrl?: string
  variantLabel?: string
  variants: ClipVariant[]
}

export type ClipNode = Node<ClipNodeData, "clip">

export const GROUP_META: Record<ClipGroup, { label: string; color: string }> = {
  idle: { label: "Grundloop", color: "#d6ff3a" },
  transition: { label: "Övergång", color: "#3ad6c4" },
  deal: { label: "Givning", color: "#ffb547" },
  reveal: { label: "Avslöjande", color: "#ff7a59" },
  speech: { label: "Replik", color: "#9d8cff" },
  custom: { label: "Nytt klipp", color: "#e6e8eb" },
}

export const TRIGGER_META: Record<Trigger, string> = {
  original: "Original",
  auto: "Automatisk",
  openclaw: "OpenClaw",
}

export const REQUIREMENT_META: Record<Requirement, string> = {
  required: "Krävs",
  recommended: "Rekommenderas",
  optional: "Valfritt",
}

const FORMAT = "9:16 · 1080×1920 · WebM alfa"

const v = (
  id: string,
  name: string,
  trigger: Trigger,
  hasFile: boolean,
  extra: Partial<ClipVariant> = {},
): ClipVariant => ({ id, name, trigger, hasFile, ...extra })

const seatVariants = Array.from({ length: 7 }, (_, i) =>
  v(`box${i}`, `Plats ${i + 1}`, "original", false, {
    condition: `deal.player.${i < 2 ? "left" : i < 5 ? "centre" : "right"}/box${i}`,
  }),
)

const COLUMN = 340
const SPEECH_ROW = 500

const node = (id: string, step: string, column: number, y: number, data: Omit<ClipNodeData, "step">): ClipNode => ({
  id,
  type: "clip",
  position: { x: column * COLUMN, y },
  data: { step, ...data },
})

export const EXTRA_HANDLES: Record<string, Array<"loop-in" | "loop-out" | "talk-out" | "talk-in">> = {
  idle: ["loop-in", "talk-out"],
  "from-shoe": ["loop-out"],
  "speech-table": ["talk-in"],
  "speech-result": ["talk-in"],
}

export const initialNodes: ClipNode[] = [
  node("idle", "01", 0, 0, {
    group: "idle",
    title: "Grundloop · lugn andning",
    slotKey: "idle.ready",
    from: "VILA",
    to: "VILA",
    durationSec: "8–12 s loop",
    format: FORMAT,
    requirement: "required",
    description:
      "Spelas mellan alla händelser. Första och sista bildrutan måste vara identiska så att loopen blir sömlös.",
    thumbnail: "/admin/_assets/admin/clips/idle.png",
    variantLabel: "Variant",
    variants: [
      v("orig", "Original", "original", true),
      v("look", "Blick mot spelaren", "auto", true, { condition: "Efter 20 s utan insats" }),
      v("cards", "Rättar till korten", "auto", false, { condition: "Var 3:e loop, slumpvis" }),
      v("wave", "Vinkar in ny spelare", "openclaw", false, { condition: "OpenClaw: player.joined" }),
    ],
  }),
  node("to-shoe", "02", 1, 0, {
    group: "transition",
    title: "Till skon",
    slotKey: "transition.shoe/to-shoe",
    from: "VILA",
    to: "REDO",
    durationSec: "0,8–1,2 s",
    format: FORMAT,
    requirement: "recommended",
    description: "Vänster hand går till kortskon. Avslutas i REDO-posen som alla givningsklipp startar från.",
    thumbnail: "/admin/_assets/admin/clips/to-shoe.png",
    variants: [v("orig", "Original", "original", false)],
  }),
  node("deal-player", "03", 2, 0, {
    group: "deal",
    title: "Ge kort · spelarplats",
    slotKey: "deal.player.*/box0–6",
    from: "REDO",
    to: "REDO",
    durationSec: "1,0–1,4 s",
    format: FORMAT,
    requirement: "recommended",
    description: "Ett klipp per spelarplats. Kortet ska landa exakt på platsens koordinat i bordsbilden.",
    thumbnail: "/admin/_assets/admin/clips/deal-player.png",
    variantLabel: "Plats",
    variants: seatVariants,
  }),
  node("dealer-up", "04", 3, 0, {
    group: "deal",
    title: "Öppet kort till dealern",
    slotKey: "deal.dealer/dealer-up",
    from: "REDO",
    to: "REDO",
    durationSec: "1,0 s",
    format: FORMAT,
    requirement: "recommended",
    description: "Dealern lägger sitt första kort med framsidan upp framför sig.",
    thumbnail: "/admin/_assets/admin/clips/dealer-up.png",
    variants: [v("orig", "Original", "original", false)],
  }),
  node("dealer-hole", "05", 4, 0, {
    group: "deal",
    title: "Dolt kort till dealern",
    slotKey: "deal.dealer/dealer-hole",
    from: "REDO",
    to: "REDO",
    durationSec: "1,0 s",
    format: FORMAT,
    requirement: "recommended",
    description: "Andra kortet läggs med baksidan upp. Används i alla rundor utan europeisk regel.",
    thumbnail: "/admin/_assets/admin/clips/dealer-hole.png",
    variants: [v("orig", "Original", "original", false)],
  }),
  node("reveal", "06", 5, 0, {
    group: "reveal",
    title: "Vänd dolt kort",
    slotKey: "reveal.dealer/dealer-hole",
    from: "REDO",
    to: "REDO",
    durationSec: "1,2 s",
    format: FORMAT,
    requirement: "recommended",
    description: "Dealern vänder hålkortet när alla spelare är klara.",
    thumbnail: "/admin/_assets/admin/clips/reveal.png",
    variants: [
      v("orig", "Original", "original", false),
      v("slow", "Långsam vändning", "auto", false, { condition: "Om dealern kan få blackjack" }),
    ],
  }),
  node("from-shoe", "07", 6, 0, {
    group: "transition",
    title: "Från skon",
    slotKey: "transition.shoe/from-shoe",
    from: "REDO",
    to: "VILA",
    durationSec: "0,8–1,2 s",
    format: FORMAT,
    requirement: "recommended",
    description: "Handen lämnar skon och dealern återgår till VILA så att grundloopen kan ta över.",
    thumbnail: "/admin/_assets/admin/clips/from-shoe.png",
    variants: [v("orig", "Original", "original", false)],
  }),
  node("speech-table", "T1", 1, SPEECH_ROW, {
    group: "speech",
    title: "Repliker · bordet",
    slotKey: "speech.goodluck · speech.other/*",
    from: "VILA",
    to: "VILA",
    durationSec: "2–4 s",
    format: `${FORMAT} + ljud`,
    requirement: "optional",
    description: "Talklipp som avbryter grundloopen vid spelhändelser och återgår till den efteråt.",
    thumbnail: "/admin/_assets/admin/clips/speech.png",
    variantLabel: "Replik",
    variants: [
      v("welcome", "Välkomsthälsning", "openclaw", false, { line: "Welcome to the table!", condition: "OpenClaw: player.joined" }),
      v("placebets", "Lägg insatser", "auto", false, { line: "Place your bets, please.", condition: "round.betting_open" }),
      v("goodluck", "Lycka till", "auto", false, { line: "Bets are closed. Good luck at my table!", condition: "round.betting_closed" }),
      v("insurance", "Försäkring", "auto", false, { line: "Insurance is open. Would you like to protect your hand?", condition: "dealer.up = A" }),
      v("double", "Dubbling", "auto", false, { line: "Doubling down. One card, let's make it count.", condition: "player.double" }),
    ],
  }),
  node("speech-result", "T2", 2, SPEECH_ROW, {
    group: "speech",
    title: "Repliker · resultat",
    slotKey: "speech.other/win · lose · push · …",
    from: "VILA",
    to: "VILA",
    durationSec: "2–4 s",
    format: `${FORMAT} + ljud`,
    requirement: "optional",
    description: "Utfallsrepliker. Väljs automatiskt utifrån rundans resultat.",
    thumbnail: "/admin/_assets/admin/clips/speech.png",
    variantLabel: "Replik",
    variants: [
      v("blackjack", "Blackjack", "auto", false, { line: "Blackjack! That is beautifully done. Congratulations!", condition: "player.blackjack" }),
      v("dealerbj", "Dealerns blackjack", "auto", false, { line: "Dealer has blackjack. This round goes to the house.", condition: "dealer.blackjack" }),
      v("bust", "Dealern över 21", "auto", false, { line: "Dealer busts! Congratulations, the table wins.", condition: "dealer.bust" }),
      v("win", "Vinst", "auto", false, { line: "Well played! Enjoy your winnings.", condition: "result.win" }),
      v("push", "Lika", "auto", false, { line: "It's a push. Your stake is returned.", condition: "result.push" }),
      v("lose", "Förlust", "auto", false, { line: "Dealer wins this one. Better luck next round.", condition: "result.lose" }),
    ],
  }),
]

const flow = (id: string, source: string, target: string, label?: string): Edge => ({
  id,
  source,
  target,
  label,
  type: "smoothstep",
  style: { stroke: "#5b6068", strokeWidth: 1.5 },
  labelStyle: { fill: "#a3a8b0", fontSize: 10, fontFamily: "var(--font-mono)" },
  labelBgStyle: { fill: "#1b1c1e" },
})

const event = (id: string, source: string, target: string, label: string): Edge => ({
  ...flow(id, source, target, label),
  sourceHandle: "talk-out",
  targetHandle: "talk-in",
  animated: true,
  style: { stroke: "#9d8cff", strokeWidth: 1.5, strokeDasharray: "4 4" },
})

const loop = (id: string, source: string, target: string, label: string): Edge => ({
  ...flow(id, source, target, label),
  sourceHandle: "loop-out",
  targetHandle: "loop-in",
  style: { stroke: "#d6ff3a", strokeWidth: 1.5, strokeOpacity: 0.55 },
})

export const initialEdges: Edge[] = [
  flow("e1", "idle", "to-shoe", "runda startar"),
  flow("e2", "to-shoe", "deal-player"),
  flow("e3", "deal-player", "dealer-up", "alla spelare har kort"),
  flow("e4", "dealer-up", "dealer-hole"),
  flow("e5", "dealer-hole", "reveal", "spelare klara"),
  flow("e6", "reveal", "from-shoe"),
  loop("e7", "from-shoe", "idle", "tillbaka till grundloop"),
  event("e8", "idle", "speech-table", "spelhändelse"),
  event("e9", "idle", "speech-result", "rundans resultat"),
]
