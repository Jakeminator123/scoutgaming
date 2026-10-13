"use client"

import { Bot, Circle, Download, Upload, Zap } from "lucide-react"
import { GROUP_META, type ClipGroup } from "@/lib/clip-catalog"
import { IDLE_CLIPS, buildManifest, type AssetKind } from "@/lib/studio-assets"
import { useStudio } from "./studio-provider"
import { cn } from "@/lib/utils"

const LEGEND_GROUPS: ClipGroup[] = ["idle", "transition", "deal", "reveal", "speech"]

export function StudioHeader() {
  const { activeDealer, activeRoom, activeGame } = useStudio()
  const path = [activeGame?.name, activeRoom?.name].filter(Boolean).join(" · ")

  return (
    <header className="flex flex-col gap-4 border-b border-sg-line px-6 py-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">
          {`// Studio · Klippkarta${path ? ` · ${path}` : ""}`}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{activeDealer?.name ?? "Ingen dealer vald"}</h1>
        <p className="mt-1 max-w-2xl text-sm text-sg-muted">
          {activeDealer
            ? "Läs kartan från vänster till höger: grundloopen startar rundan, övre raden är givningen och nedre raden är talklippen som avbryter grundloopen."
            : "Det här rummet har ingen dealer än. Lägg till en med + vid Dealer i raden ovanför."}
        </p>
      </div>

      <Composition />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-sg-muted">
        {LEGEND_GROUPS.map((group) => (
          <span key={group} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: GROUP_META[group].color }} aria-hidden />
            {GROUP_META[group].label}
          </span>
        ))}
        <span className="h-3 w-px bg-sg-line" aria-hidden />
        <span className="flex items-center gap-1.5"><Circle className="size-3" aria-hidden />Original</span>
        <span className="flex items-center gap-1.5"><Zap className="size-3 text-sg-lime" aria-hidden />Automatisk variant</span>
        <span className="flex items-center gap-1.5"><Bot className="size-3 text-sg-lime" aria-hidden />OpenClaw-variant</span>
        <span className="h-3 w-px bg-sg-line" aria-hidden />
        <span className="flex items-center gap-1.5"><Upload className="size-3" aria-hidden />Dra in en video på en box eller på ytan</span>
      </div>
    </header>
  )
}

function Composition() {
  const { activeDealer, assets, dealers, operators, games, rooms, updateDealer } = useStudio()
  if (!activeDealer) return null

  const table = assets.find((item) => item.id === activeDealer.tableId)
  const background = assets.find((item) => item.id === activeDealer.backgroundId)
  const allowedIdle = IDLE_CLIPS.filter(
    (clip) => [table, background].every((item) => !item || item.idleClipIds.includes(clip.id)),
  )
  const idleBlocked = !allowedIdle.some((clip) => clip.id === activeDealer.idleClipId)

  const exportManifest = () => {
    const blob = new Blob([JSON.stringify(buildManifest({ operators, games, rooms, dealers, assets }), null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "croupier-studio.manifest.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const assetSelect = (kind: AssetKind, label: string, value: string | null, key: "tableId" | "backgroundId") => (
    <label className="flex min-w-40 flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => updateDealer(activeDealer.id, { [key]: event.target.value || null })}
        className="rounded border border-sg-line bg-sg-bg px-2 py-1.5 text-xs text-sg-text outline-none focus:border-sg-lime"
      >
        <option value="">{"– Ingen –"}</option>
        {assets
          .filter((item) => item.kind === kind)
          .map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
      </select>
    </label>
  )

  return (
    <section aria-label="Sammansättning" className="flex flex-wrap items-end gap-4 rounded-lg border border-sg-line bg-sg-panel p-3">
      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded border border-sg-line bg-sg-bg" aria-hidden>
        {background?.src && <img src={background.src || "/placeholder.svg"} alt="" className="absolute inset-0 size-full object-cover" />}
        <img src="/admin/_assets/admin/clips/idle.png" alt="" className="absolute bottom-[18%] left-1/2 h-[78%] -translate-x-1/2 object-contain" />
        {table?.src && (
          <img src={table.src || "/placeholder.svg"} alt="" className="absolute inset-x-0 bottom-0 h-[45%] w-full object-cover mix-blend-lighten" />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[9px] uppercase tracking-wider text-sg-teal">Sammansättning</span>
        <span className="text-sm font-medium">{activeDealer.name}</span>
      </div>
      {assetSelect("table", "Bord", activeDealer.tableId, "tableId")}
      {assetSelect("background", "Bakgrund", activeDealer.backgroundId, "backgroundId")}
      <label className="flex min-w-44 flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">Grundloop</span>
        <select
          value={activeDealer.idleClipId}
          onChange={(event) => updateDealer(activeDealer.id, { idleClipId: event.target.value })}
          className={cn(
            "rounded border bg-sg-bg px-2 py-1.5 text-xs text-sg-text outline-none focus:border-sg-lime",
            idleBlocked ? "border-sg-amber" : "border-sg-line",
          )}
        >
          {IDLE_CLIPS.map((clip) => (
            <option key={clip.id} value={clip.id} disabled={!allowedIdle.includes(clip)}>
              {clip.name}
            </option>
          ))}
        </select>
      </label>
      {idleBlocked && (
        <p className="pb-1.5 text-[11px] text-sg-amber">Grundloopen är inte tillåten för valt bord/bakgrund.</p>
      )}
      <button
        type="button"
        onClick={exportManifest}
        className="ml-auto flex items-center gap-1.5 rounded border border-sg-line px-3 py-1.5 text-xs text-sg-muted transition-colors hover:border-sg-lime hover:text-sg-lime"
      >
        <Download className="size-3.5" aria-hidden />
        Exportera manifest
      </button>
    </section>
  )
}
