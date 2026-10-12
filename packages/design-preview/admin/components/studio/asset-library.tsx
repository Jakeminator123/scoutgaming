"use client"

import { useState, type DragEvent } from "react"
import { Film, ImageOff, Plus, Trash2 } from "lucide-react"
import { useStudio } from "./studio-provider"
import { BackgroundRotationPanel } from "./background-rotation"
import {
  ASSET_KIND_META,
  IDLE_CLIPS,
  LANES,
  LANE_META,
  type AssetKind,
  type StudioAsset,
} from "@/lib/studio-assets"
import { cn } from "@/lib/utils"

export function AssetLibrary() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-10 px-6 py-6">
        <AssetSection
          kind="background"
          description="Bakgrunden ligger bakom dealern och bordet, som står i mitten närmast kameran. Håll centrum och förgrund fria. Bild eller loopande MP4/WebM."
        />
        <AssetSection
          kind="table"
          description="Bordet läggs ovanpå dealern. Lanes anger spelarplatser. Bakgrundsbyte styr vilka bakgrunder som roteras automatiskt eller av OpenClaw."
        />
      </div>
    </div>
  )
}

function AssetSection({ kind, description }: { kind: AssetKind; description: string }) {
  const { assets, addAsset } = useStudio()
  const [errors, setErrors] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const items = assets.filter((item) => item.kind === kind)
  const meta = ASSET_KIND_META[kind]

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const failed = Array.from(files)
      .map((file) => addAsset(kind, file))
      .flatMap((result) => (result.ok ? [] : [result.error]))
    setErrors(failed)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <section aria-labelledby={`${kind}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`${kind}-heading`} className="text-lg font-semibold tracking-tight">
            {meta.plural}
            <span className="ml-2 font-mono text-xs font-normal text-sg-muted">{items.length}</span>
          </h2>
          <p className="text-sm text-sg-muted">{description}</p>
        </div>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded border border-sg-amber/40 bg-sg-amber/10 px-3 py-2 text-xs text-sg-amber">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <AssetCard asset={item} />
          </li>
        ))}
        <li>
          <label
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex h-full min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-sg-muted transition-colors hover:border-sg-lime hover:text-sg-text",
              isDragOver ? "border-sg-lime bg-sg-lime/5 text-sg-text" : "border-sg-line",
            )}
          >
            <Plus className="size-5" aria-hidden />
            <span>{`Lägg till ${meta.label.toLowerCase()}`}</span>
            <span className="font-mono text-[10px]">Dra in bild/video eller klicka</span>
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple
              className="sr-only"
              onChange={(event) => {
                handleFiles(event.target.files)
                event.target.value = ""
              }}
            />
          </label>
        </li>
      </ul>
    </section>
  )
}

function AssetCard({ asset }: { asset: StudioAsset }) {
  const { assets, dealers, removeAsset, toggleLane, toggleIdleClip, toggleLoop } = useStudio()
  const usedBy = dealers.filter((item) => item.tableId === asset.id || item.backgroundId === asset.id)
  const rotatedOnTables = assets.filter((item) => item.rotation?.mode !== "off" && item.rotation?.backgroundIds.includes(asset.id))

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-sg-line bg-sg-panel">
      <div className="relative aspect-video bg-sg-bg">
        {asset.src ? (
          asset.isVideo ? (
            <>
              <video src={asset.src} className="size-full object-cover" muted loop={asset.loop} autoPlay playsInline />
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-sg-bg/80 px-1.5 py-0.5 font-mono text-[9px] uppercase text-sg-text">
                <Film className="size-3" aria-hidden />
                {asset.loop ? "Loop" : "Video"}
              </span>
            </>
          ) : (
            <img src={asset.src || "/placeholder.svg"} alt={asset.name} className="size-full object-cover" />
          )
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 text-sg-muted">
            <ImageOff className="size-5" aria-hidden />
            <span className="font-mono text-[10px] uppercase">Miniatyr saknas</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => removeAsset(asset.id)}
          aria-label={`Ta bort ${asset.name}`}
          className="absolute right-2 top-2 rounded bg-sg-bg/80 p-1.5 text-sg-muted transition-colors hover:text-sg-red"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div>
          <h3 className="text-sm font-semibold leading-tight">{asset.name}</h3>
          <p className="font-mono text-[10px] text-sg-muted">{asset.fileKey}</p>
          <p className="mt-1 text-[11px] text-sg-muted">
            {usedBy.length > 0 ? `Används av ${usedBy.map((item) => item.name).join(", ")}` : "Används inte av någon dealer"}
          </p>
          {rotatedOnTables.length > 0 && (
            <p className="text-[11px] text-sg-teal">{`I bakgrundsbyte på ${rotatedOnTables.map((item) => item.name).join(", ")}`}</p>
          )}
        </div>

        {asset.isVideo && (
          <ChipGroup label="Video">
            <Chip active={asset.loop} onClick={() => toggleLoop(asset.id)}>
              {asset.loop ? "Loopar" : "Spelas en gång"}
            </Chip>
          </ChipGroup>
        )}

        {asset.kind === "table" && <BackgroundRotationPanel table={asset} />}

        {asset.kind === "table" && (
          <ChipGroup label="Lanes">
            {LANES.map((lane) => (
              <Chip key={lane} active={asset.lanes.includes(lane)} onClick={() => toggleLane(asset.id, lane)}>
                {`${LANE_META[lane].label} · ${LANE_META[lane].seats}`}
              </Chip>
            ))}
          </ChipGroup>
        )}

        <ChipGroup label="Grundloopar">
          {IDLE_CLIPS.map((clip) => (
            <Chip key={clip.id} active={asset.idleClipIds.includes(clip.id)} onClick={() => toggleIdleClip(asset.id, clip.id)}>
              {clip.name}
            </Chip>
          ))}
        </ChipGroup>
      </div>
    </article>
  )
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
        active ? "border-sg-lime/60 bg-sg-lime/10 text-sg-lime" : "border-sg-line text-sg-muted line-through hover:text-sg-text",
      )}
    >
      {children}
    </button>
  )
}
