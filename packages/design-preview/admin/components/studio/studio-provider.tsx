"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import {
  DEALER_KINDS,
  DEFAULT_ROTATION,
  IDLE_CLIPS,
  ROTATION_INTERVAL,
  ROTATION_MODES,
  seedSnapshot,
  type BackgroundRotation,
  slugify,
  type AssetKind,
  type Dealer,
  type DealerKind,
  type Lane,
  type StudioAsset,
  type StudioSnapshot,
} from "@/lib/studio-assets"
import { DEFAULT_SHARE_PCT, LEVEL_META, type Game, type Level, type Operator, type OperatorStatus, type Room } from "@/lib/studio-hierarchy"
import {
  CURRENT_USER,
  nowIso,
  seedAudit,
  seedTerms,
  type AccessLevel,
  type AuditCategory,
  type AuditEntry,
  type RevenueTerm,
  type TermScope,
} from "@/lib/ops"

type Result = { ok: true } | { ok: false; error: string }
type EntityLevel = Level | "dealer"
type Selection = Record<EntityLevel, string | null>

type StudioContextValue = StudioSnapshot & {
  activeOperator: Operator | null
  activeGame: Game | null
  activeRoom: Room | null
  activeDealer: Dealer | null
  gamesInOperator: Game[]
  roomsInGame: Room[]
  dealersInRoom: Dealer[]
  select: (level: EntityLevel, id: string) => void
  selectDealerPath: (dealerId: string) => void
  addEntity: (level: EntityLevel, name: string, options?: { dealerKind?: DealerKind }) => Result
  removeEntity: (level: EntityLevel, id: string, reason?: string) => void
  updateDealer: (id: string, patch: Partial<Omit<Dealer, "id" | "roomId">>) => void
  addAsset: (kind: AssetKind, file: File) => Result
  removeAsset: (id: string) => void
  toggleLane: (id: string, lane: Lane) => void
  toggleIdleClip: (id: string, clipId: string) => void
  toggleLoop: (id: string) => void
  updateRotation: (tableId: string, patch: Partial<BackgroundRotation>) => void
  toggleRotationBackground: (tableId: string, backgroundId: string) => void
  terms: RevenueTerm[]
  audit: AuditEntry[]
  accessLevel: AccessLevel
  setAccessLevel: (level: AccessLevel) => void
  log: (category: AuditCategory, action: string, reason?: string) => void
  setOperatorShare: (operatorId: string, pct: number, reason: string) => void
  setOperatorStatus: (operatorId: string, status: OperatorStatus, reason: string) => void
  upsertTerm: (operatorId: string, scope: TermScope, targetId: string, pct: number, reason: string) => void
  removeTerm: (termId: string, reason: string) => void
  setDealerKind: (dealerId: string, kind: DealerKind) => void
  setDealerRevshare: (dealerId: string, pct: number, reason: string) => void
}

const StudioContext = createContext<StudioContextValue | null>(null)

const LOWER_LEVELS: Record<EntityLevel, EntityLevel[]> = {
  operator: ["game", "room", "dealer"],
  game: ["room", "dealer"],
  room: ["dealer"],
  dealer: [],
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

const newId = (name: string, fallback: string) => `${slugify(name) || fallback}-${Date.now().toString(36)}`

export function StudioProvider({
  children,
  initialSnapshot = seedSnapshot,
}: {
  children: ReactNode
  initialSnapshot?: StudioSnapshot
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [selection, setSelection] = useState<Selection>({ operator: null, game: null, room: null, dealer: null })
  const [terms, setTerms] = useState<RevenueTerm[]>(seedTerms)
  const [audit, setAudit] = useState<AuditEntry[]>(seedAudit)
  const [accessLevel, setAccessLevelState] = useState<AccessLevel>(1)

  const activeOperator = snapshot.operators.find((item) => item.id === selection.operator) ?? snapshot.operators[0] ?? null
  const gamesInOperator = snapshot.games.filter((item) => item.operatorId === activeOperator?.id)
  const activeGame = gamesInOperator.find((item) => item.id === selection.game) ?? gamesInOperator[0] ?? null
  const roomsInGame = snapshot.rooms.filter((item) => item.gameId === activeGame?.id)
  const activeRoom = roomsInGame.find((item) => item.id === selection.room) ?? roomsInGame[0] ?? null
  const dealersInRoom = snapshot.dealers.filter((item) => item.roomId === activeRoom?.id)
  const activeDealer = dealersInRoom.find((item) => item.id === selection.dealer) ?? dealersInRoom[0] ?? null

  const log = useCallback((category: AuditCategory, action: string, reason?: string) => {
    setAudit((current) => [
      { id: `a-${Date.now().toString(36)}-${current.length}`, at: nowIso(), actor: CURRENT_USER, category, action, reason },
      ...current,
    ])
  }, [])

  const nameOf = useCallback(
    (level: EntityLevel, id: string) => {
      const list: { id: string; name: string }[] = {
        operator: snapshot.operators,
        game: snapshot.games,
        room: snapshot.rooms,
        dealer: snapshot.dealers,
      }[level]
      return list.find((item) => item.id === id)?.name ?? id
    },
    [snapshot],
  )

  const select = useCallback((level: EntityLevel, id: string) => {
    setSelection((current) => {
      const next = { ...current, [level]: id }
      for (const lower of LOWER_LEVELS[level]) next[lower] = null
      return next
    })
  }, [])

  const selectDealerPath = useCallback(
    (dealerId: string) => {
      const dealer = snapshot.dealers.find((item) => item.id === dealerId)
      const room = snapshot.rooms.find((item) => item.id === dealer?.roomId)
      const game = snapshot.games.find((item) => item.id === room?.gameId)
      if (!dealer || !room || !game) return
      setSelection({ operator: game.operatorId, game: game.id, room: room.id, dealer: dealer.id })
    },
    [snapshot],
  )

  const addEntity = useCallback(
    (level: EntityLevel, rawName: string, options?: { dealerKind?: DealerKind }): Result => {
      const name = rawName.trim()
      if (!name) return { ok: false, error: "Ange ett namn." }

      const parentId = { operator: "root", game: activeOperator?.id, room: activeGame?.id, dealer: activeRoom?.id }[level]
      if (!parentId) return { ok: false, error: "Välj eller skapa nivån ovanför först." }

      const siblings: { name: string }[] = {
        operator: snapshot.operators,
        game: gamesInOperator,
        room: roomsInGame,
        dealer: dealersInRoom,
      }[level]
      if (siblings.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, error: `${name} finns redan här.` }
      }

      const id = newId(name, level)
      const dealerKind = options?.dealerKind ?? "standard"
      setSnapshot((current) => {
        switch (level) {
          case "operator":
            return {
              ...current,
              operators: [...current.operators, { id, name, sharePct: DEFAULT_SHARE_PCT, status: "active", license: "Ej angiven" }],
            }
          case "game":
            return { ...current, games: [...current.games, { id, operatorId: parentId, name, kind: slugify(name) }] }
          case "room":
            return { ...current, rooms: [...current.rooms, { id, gameId: parentId, name, seats: 7 }] }
          case "dealer":
            return {
              ...current,
              dealers: [
                ...current.dealers,
                {
                  id,
                  roomId: parentId,
                  name,
                  kind: dealerKind,
                  revsharePct: 0,
                  tableId: current.assets.find((item) => item.kind === "table")?.id ?? null,
                  backgroundId: current.assets.find((item) => item.kind === "background")?.id ?? null,
                  idleClipId: IDLE_CLIPS[0]?.id ?? "orig",
                },
              ],
            }
        }
      })
      const kindLabel = level === "dealer" ? ` (${DEALER_KINDS[dealerKind].label.toLowerCase()})` : ""
      log("Struktur", `La till ${LEVEL_META[level].label.toLowerCase()} ${name}${kindLabel}`)
      select(level, id)
      return { ok: true }
    },
    [snapshot.operators, gamesInOperator, roomsInGame, dealersInRoom, activeOperator, activeGame, activeRoom, select, log],
  )

  const removeEntity = useCallback(
    (level: EntityLevel, id: string, reason?: string) => {
      log("Struktur", `Tog bort ${LEVEL_META[level].label.toLowerCase()} ${nameOf(level, id)}`, reason)
      setSnapshot((current) => {
        const operatorIds = level === "operator" ? [id] : []
        const gameIds =
          level === "game" ? [id] : current.games.filter((item) => operatorIds.includes(item.operatorId)).map((item) => item.id)
        const roomIds =
          level === "room" ? [id] : current.rooms.filter((item) => gameIds.includes(item.gameId)).map((item) => item.id)
        const dealers = current.dealers.filter(
          (item) => !roomIds.includes(item.roomId) && !(level === "dealer" && item.id === id),
        )
        const dealerIds = new Set(dealers.map((item) => item.id))
        const remainingGames = current.games.filter((item) => !gameIds.includes(item.id))
        setTerms((list) =>
          list.filter(
            (term) =>
              !operatorIds.includes(term.operatorId) &&
              (term.scope === "dealer" ? dealerIds.has(term.targetId) : remainingGames.some((game) => game.id === term.targetId)),
          ),
        )
        return {
          ...current,
          operators: current.operators.filter((item) => !operatorIds.includes(item.id)),
          games: remainingGames,
          rooms: current.rooms.filter((item) => !roomIds.includes(item.id)),
          dealers,
        }
      })
      setSelection((current) => {
        if (current[level] !== id) return current
        const next = { ...current, [level]: null }
        for (const lower of LOWER_LEVELS[level]) next[lower] = null
        return next
      })
    },
    [log, nameOf],
  )

  const updateDealer = useCallback((id: string, patch: Partial<Omit<Dealer, "id" | "roomId">>) => {
    setSnapshot((current) => ({
      ...current,
      dealers: current.dealers.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }, [])

  const patchOperator = useCallback((id: string, patch: Partial<Operator>) => {
    setSnapshot((current) => ({
      ...current,
      operators: current.operators.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }, [])

  const setOperatorShare = useCallback(
    (operatorId: string, pct: number, reason: string) => {
      const operator = snapshot.operators.find((item) => item.id === operatorId)
      if (!operator || operator.sharePct === pct) return
      patchOperator(operatorId, { sharePct: pct })
      log("Avtal", `${operator.name}: grundandel ${operator.sharePct} % → ${pct} %`, reason)
    },
    [snapshot.operators, patchOperator, log],
  )

  const setOperatorStatus = useCallback(
    (operatorId: string, status: OperatorStatus, reason: string) => {
      patchOperator(operatorId, { status })
      log("Struktur", `${nameOf("operator", operatorId)} ${status === "paused" ? "pausad" : "aktiverad"}`, reason)
    },
    [patchOperator, log, nameOf],
  )

  const upsertTerm = useCallback(
    (operatorId: string, scope: TermScope, targetId: string, pct: number, reason: string) => {
      const existing = terms.find((term) => term.scope === scope && term.targetId === targetId)
      const label = `${nameOf(scope, targetId)} (${nameOf("operator", operatorId)})`
      if (existing) {
        if (existing.pct === pct) return
        setTerms((list) => list.map((term) => (term.id === existing.id ? { ...term, pct } : term)))
        log("Avtal", `${label}: andel ${existing.pct} % → ${pct} %`, reason)
      } else {
        setTerms((list) => [...list, { id: `t-${Date.now().toString(36)}`, operatorId, scope, targetId, pct }])
        log("Avtal", `${label}: egen andel ${pct} %`, reason)
      }
    },
    [terms, nameOf, log],
  )

  const removeTerm = useCallback(
    (termId: string, reason: string) => {
      const term = terms.find((item) => item.id === termId)
      if (!term) return
      setTerms((list) => list.filter((item) => item.id !== termId))
      log("Avtal", `${nameOf(term.scope, term.targetId)}: egen andel ${term.pct} % borttagen, följer grundavtal`, reason)
    },
    [terms, nameOf, log],
  )

  const setDealerKind = useCallback(
    (dealerId: string, kind: DealerKind) => {
      const dealer = snapshot.dealers.find((item) => item.id === dealerId)
      if (!dealer || dealer.kind === kind) return
      updateDealer(dealerId, { kind, revsharePct: kind === "celebrity" ? dealer.revsharePct : 0 })
      log("Avtal", `${dealer.name}: typ ${DEALER_KINDS[dealer.kind].label} → ${DEALER_KINDS[kind].label}`)
    },
    [snapshot.dealers, updateDealer, log],
  )

  const setDealerRevshare = useCallback(
    (dealerId: string, pct: number, reason: string) => {
      const dealer = snapshot.dealers.find((item) => item.id === dealerId)
      if (!dealer || dealer.revsharePct === pct) return
      updateDealer(dealerId, { revsharePct: pct })
      log("Avtal", `${dealer.name}: revshare ${dealer.revsharePct} % → ${pct} %`, reason)
    },
    [snapshot.dealers, updateDealer, log],
  )

  const setAccessLevel = useCallback((level: AccessLevel) => setAccessLevelState(level), [])

  const addAsset = useCallback(
    (kind: AssetKind, file: File): Result => {
      const isVideo = file.type.startsWith("video/")
      if (!isVideo && !file.type.startsWith("image/")) {
        return { ok: false, error: `${file.name}: endast bild eller video.` }
      }
      const name = file.name.replace(/\.[^.]+$/, "")
      const fileKey = `${kind}.${slugify(name)}`
      const duplicate = snapshot.assets.find(
        (item) => item.kind === kind && (item.fileKey === fileKey || item.name.toLowerCase() === name.toLowerCase()),
      )
      if (duplicate) return { ok: false, error: `${file.name}: finns redan som "${duplicate.name}".` }

      const created: StudioAsset = {
        id: newId(name, kind),
        kind,
        name,
        fileKey,
        src: URL.createObjectURL(file),
        isVideo,
        loop: isVideo,
        lanes: kind === "table" ? ["left", "centre", "right"] : [],
        idleClipIds: [IDLE_CLIPS[0]?.id ?? "orig"],
        ...(kind === "table" ? { rotation: DEFAULT_ROTATION } : {}),
      }
      setSnapshot((current) => ({ ...current, assets: [...current.assets, created] }))
      return { ok: true }
    },
    [snapshot.assets],
  )

  const removeAsset = useCallback((id: string) => {
    setSnapshot((current) => {
      const target = current.assets.find((item) => item.id === id)
      if (target?.src?.startsWith("blob:")) URL.revokeObjectURL(target.src)
      return {
        ...current,
        assets: current.assets
          .filter((item) => item.id !== id)
          .map((item) =>
            item.rotation?.backgroundIds.includes(id)
              ? { ...item, rotation: { ...item.rotation, backgroundIds: item.rotation.backgroundIds.filter((bg) => bg !== id) } }
              : item,
          ),
        dealers: current.dealers.map((item) => ({
          ...item,
          tableId: item.tableId === id ? null : item.tableId,
          backgroundId: item.backgroundId === id ? null : item.backgroundId,
        })),
      }
    })
  }, [])

  const patchAsset = useCallback((id: string, update: (item: StudioAsset) => StudioAsset) => {
    setSnapshot((current) => ({
      ...current,
      assets: current.assets.map((item) => (item.id === id ? update(item) : item)),
    }))
  }, [])

  const toggleLane = useCallback(
    (id: string, lane: Lane) => patchAsset(id, (item) => ({ ...item, lanes: toggle(item.lanes, lane) })),
    [patchAsset],
  )

  const toggleIdleClip = useCallback(
    (id: string, clipId: string) =>
      patchAsset(id, (item) => ({ ...item, idleClipIds: toggle(item.idleClipIds, clipId) })),
    [patchAsset],
  )

  const toggleLoop = useCallback(
    (id: string) => patchAsset(id, (item) => (item.isVideo ? { ...item, loop: !item.loop } : item)),
    [patchAsset],
  )

  const updateRotation = useCallback(
    (tableId: string, patch: Partial<BackgroundRotation>) => {
      const table = snapshot.assets.find((item) => item.id === tableId)
      if (!table || table.kind !== "table") return
      const current = table.rotation ?? DEFAULT_ROTATION
      const next = { ...current, ...patch }
      next.intervalSec = Math.min(ROTATION_INTERVAL.max, Math.max(ROTATION_INTERVAL.min, Math.round(next.intervalSec)))
      next.jitterSec = Math.min(Math.floor(next.intervalSec / 2), Math.max(0, Math.round(next.jitterSec)))
      patchAsset(tableId, (item) => ({ ...item, rotation: next }))
      if (patch.mode && patch.mode !== current.mode) {
        log("Struktur", `${table.name}: bakgrundsbyte ${ROTATION_MODES[current.mode].label} → ${ROTATION_MODES[patch.mode].label}`)
      }
    },
    [snapshot.assets, patchAsset, log],
  )

  const toggleRotationBackground = useCallback(
    (tableId: string, backgroundId: string) => {
      const table = snapshot.assets.find((item) => item.id === tableId)
      const current = table?.rotation ?? DEFAULT_ROTATION
      updateRotation(tableId, { backgroundIds: toggle(current.backgroundIds, backgroundId) })
    },
    [snapshot.assets, updateRotation],
  )

  const value = useMemo<StudioContextValue>(
    () => ({
      ...snapshot,
      activeOperator,
      activeGame,
      activeRoom,
      activeDealer,
      gamesInOperator,
      roomsInGame,
      dealersInRoom,
      select,
      selectDealerPath,
      addEntity,
      removeEntity,
      updateDealer,
      addAsset,
      removeAsset,
      toggleLane,
      toggleIdleClip,
      toggleLoop,
      updateRotation,
      toggleRotationBackground,
      terms,
      audit,
      accessLevel,
      setAccessLevel,
      log,
      setOperatorShare,
      setOperatorStatus,
      upsertTerm,
      removeTerm,
      setDealerKind,
      setDealerRevshare,
    }),
    [
      snapshot,
      activeOperator,
      activeGame,
      activeRoom,
      activeDealer,
      gamesInOperator,
      roomsInGame,
      dealersInRoom,
      select,
      selectDealerPath,
      addEntity,
      removeEntity,
      updateDealer,
      addAsset,
      removeAsset,
      toggleLane,
      toggleIdleClip,
      toggleLoop,
      updateRotation,
      toggleRotationBackground,
      terms,
      audit,
      accessLevel,
      setAccessLevel,
      log,
      setOperatorShare,
      setOperatorStatus,
      upsertTerm,
      removeTerm,
      setDealerKind,
      setDealerRevshare,
    ],
  )

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio() {
  const context = useContext(StudioContext)
  if (!context) throw new Error("useStudio must be used inside <StudioProvider>")
  return context
}
