import { initialNodes, type ClipNode, type ClipVariant } from "@/lib/clip-catalog"
import { seedHierarchy, type Hierarchy } from "@/lib/studio-hierarchy"

export type Lane = "left" | "centre" | "right"
export type AssetKind = "background" | "table"

export const LANES: Lane[] = ["left", "centre", "right"]

export const LANE_META: Record<Lane, { label: string; seats: string }> = {
  left: { label: "Vänster", seats: "box0–1" },
  centre: { label: "Mitten", seats: "box2–4" },
  right: { label: "Höger", seats: "box5–6" },
}

export const ASSET_KIND_META: Record<AssetKind, { label: string; plural: string }> = {
  background: { label: "Bakgrund", plural: "Bakgrunder" },
  table: { label: "Bord", plural: "Bord" },
}

export type RotationMode = "off" | "random" | "sequence" | "openclaw"

export const ROTATION_MODES: Record<RotationMode, { label: string; hint: string }> = {
  off: { label: "Av", hint: "Dealerns valda bakgrund visas hela tiden" },
  random: { label: "Slump", hint: "Byter till en slumpad bakgrund i listan med jämna mellanrum" },
  sequence: { label: "Ordning", hint: "Går igenom listan i tur och ordning" },
  openclaw: { label: "OpenClaw", hint: "Agenten väljer bakgrund via eventet nedan, t.ex. vid storvinst" },
}

export const ROTATION_INTERVAL = { min: 5, max: 600, default: 25 }

export type BackgroundRotation = {
  mode: RotationMode
  intervalSec: number
  jitterSec: number
  backgroundIds: string[]
}

export const DEFAULT_ROTATION: BackgroundRotation = {
  mode: "off",
  intervalSec: ROTATION_INTERVAL.default,
  jitterSec: 0,
  backgroundIds: [],
}

export type StudioAsset = {
  id: string
  kind: AssetKind
  name: string
  fileKey: string
  src: string | null
  isVideo: boolean
  loop: boolean
  lanes: Lane[]
  idleClipIds: string[]
  rotation?: BackgroundRotation
}

export const rotationEvent = (tableId: string) => `table.${tableId}.background.set`

export type DealerKind = "standard" | "celebrity" | "exclusive"

export const DEALER_KINDS: Record<DealerKind, { label: string; hint: string }> = {
  standard: { label: "Standard", hint: "Studiodealer utan egen andel" },
  celebrity: { label: "Kändis", hint: "Får revshare på GGR i sina rum" },
  exclusive: { label: "Exklusiv", hint: "Låst till ett spelbolag" },
}

export type Dealer = {
  id: string
  roomId: string
  name: string
  kind: DealerKind
  revsharePct: number
  tableId: string | null
  backgroundId: string | null
  idleClipId: string
}

export type StudioSnapshot = Hierarchy & {
  dealers: Dealer[]
  assets: StudioAsset[]
}

export const IDLE_CLIPS: ClipVariant[] = initialNodes.find((node) => node.id === "idle")?.data.variants ?? []

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const asset = (
  id: string,
  kind: AssetKind,
  name: string,
  src: string,
  idleClipIds: string[],
  lanes: Lane[] = [],
  rotation?: BackgroundRotation,
): StudioAsset => ({
  id,
  kind,
  name,
  fileKey: `${kind}.${id}`,
  src,
  isVideo: false,
  loop: false,
  lanes,
  idleClipIds,
  ...(kind === "table" ? { rotation: rotation ?? DEFAULT_ROTATION } : {}),
})

const dealer = (
  roomId: string,
  name: string,
  tableId: string,
  backgroundId: string,
  idleClipId = "orig",
  kind: DealerKind = "standard",
  revsharePct = 0,
): Dealer => ({
  id: `${roomId}-${slugify(name)}`,
  roomId,
  name,
  kind,
  revsharePct,
  tableId,
  backgroundId,
  idleClipId,
})

export const seedSnapshot: StudioSnapshot = {
  ...seedHierarchy,
  assets: [
    asset("studio-dark", "background", "Studio · mörk", "/admin/_assets/admin/assets/bg-studio-dark.png", ["orig", "look", "cards", "wave"]),
    asset("lounge", "background", "Lounge · varm", "/admin/_assets/admin/assets/bg-lounge.png", ["orig", "look"]),
    asset("teal", "background", "Studio · turkos", "/admin/_assets/admin/assets/bg-teal.png", ["orig"]),
    asset("green-felt", "table", "Blackjack · grön filt", "/admin/_assets/admin/assets/table-green.png", ["orig", "look", "cards", "wave"], LANES, {
      mode: "random",
      intervalSec: 25,
      jitterSec: 5,
      backgroundIds: ["studio-dark", "teal"],
    }),
    asset("black-felt", "table", "Blackjack · svart filt", "/admin/_assets/admin/assets/table-black.png", ["orig", "wave"], LANES),
  ],
  dealers: [
    dealer("nb-bj-classic", "Astrid", "green-felt", "studio-dark"),
    dealer("nb-bj-classic", "Jakob", "green-felt", "teal"),
    dealer("nb-bj-vip", "Vera", "green-felt", "lounge", "look", "celebrity", 4),
    dealer("nb-bj-vip", "Mei", "black-felt", "lounge"),
    dealer("nb-bac-1", "Johanna", "green-felt", "studio-dark", "cards"),
    dealer("ln-bj-1", "Elias", "black-felt", "studio-dark", "wave", "exclusive"),
  ],
}

export const MANIFEST_SCHEMA = "scout.croupier-studio/1"

export function buildManifest(snapshot: StudioSnapshot, nodes: ClipNode[] = initialNodes) {
  const byId = new Map(snapshot.assets.map((item) => [item.id, item]))
  const slots = nodes
    .filter((node) => node.data.group !== "custom")
    .map((node) => ({
      slotKey: node.data.slotKey,
      group: node.data.group,
      from: node.data.from,
      to: node.data.to,
      requirement: node.data.requirement,
      variants: node.data.variants.map(({ id, trigger, condition, line, hasFile }) => ({
        id,
        trigger,
        condition: condition ?? null,
        line: line ?? null,
        hasFile,
      })),
    }))

  return {
    schema: MANIFEST_SCHEMA,
    generatedAt: new Date().toISOString(),
    lanes: LANES.map((lane) => ({ id: lane, seats: LANE_META[lane].seats })),
    assets: snapshot.assets.map(({ id, kind, fileKey, isVideo, loop, lanes, idleClipIds, rotation }) => ({
      id,
      kind,
      fileKey,
      media: isVideo ? { type: "video", loop } : { type: "image" },
      lanes,
      idleClips: idleClipIds.map((clipId) => `idle.ready/${clipId}`),
      ...(rotation && rotation.mode !== "off"
        ? {
            backgroundRotation: {
              mode: rotation.mode,
              intervalSec: rotation.mode === "openclaw" ? null : rotation.intervalSec,
              jitterSec: rotation.mode === "openclaw" ? null : rotation.jitterSec,
              backgrounds: rotation.backgroundIds.flatMap((bgId) => byId.get(bgId)?.fileKey ?? []),
              event: rotation.mode === "openclaw" ? rotationEvent(id) : null,
            },
          }
        : {}),
    })),
    operators: snapshot.operators.map((operator) => ({
      id: operator.id,
      name: operator.name,
      games: snapshot.games
        .filter((game) => game.operatorId === operator.id)
        .map((game) => ({
          id: game.id,
          name: game.name,
          kind: game.kind,
          rooms: snapshot.rooms
            .filter((room) => room.gameId === game.id)
            .map((room) => ({
              id: room.id,
              name: room.name,
              seats: room.seats,
              dealers: snapshot.dealers
                .filter((item) => item.roomId === room.id)
                .map((item) => ({
                  id: item.id,
                  name: item.name,
                  composition: {
                    table: item.tableId ? byId.get(item.tableId)?.fileKey ?? null : null,
                    background: item.backgroundId ? byId.get(item.backgroundId)?.fileKey ?? null : null,
                    idleClip: `idle.ready/${item.idleClipId}`,
                  },
                })),
            })),
        })),
    })),
    slots,
  }
}

export type StudioManifest = ReturnType<typeof buildManifest>
