"use client"

import { useEffect, useId, useState } from "react"
import { Bot, Film, Shuffle } from "lucide-react"
import { useStudio } from "./studio-provider"
import {
  DEFAULT_ROTATION,
  ROTATION_INTERVAL,
  ROTATION_MODES,
  rotationEvent,
  type BackgroundRotation,
  type RotationMode,
  type StudioAsset,
} from "@/lib/studio-assets"
import { cn } from "@/lib/utils"

const MODES = Object.keys(ROTATION_MODES) as RotationMode[]

function nextDelayMs({ intervalSec, jitterSec }: BackgroundRotation) {
  const offset = jitterSec > 0 ? (Math.random() * 2 - 1) * jitterSec : 0
  return Math.max(ROTATION_INTERVAL.min, intervalSec + offset) * 1000
}

function pickNext(rotation: BackgroundRotation, currentId: string | null) {
  const pool = rotation.backgroundIds
  if (pool.length === 0) return null
  if (rotation.mode === "sequence") {
    const index = currentId ? pool.indexOf(currentId) : -1
    return pool[(index + 1) % pool.length]
  }
  const others = pool.length > 1 ? pool.filter((id) => id !== currentId) : pool
  return others[Math.floor(Math.random() * others.length)]
}

function useRotationPreview(rotation: BackgroundRotation) {
  const [currentId, setCurrentId] = useState<string | null>(rotation.backgroundIds[0] ?? null)
  const [dueAt, setDueAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const timed = rotation.mode === "random" || rotation.mode === "sequence"
  const poolKey = rotation.backgroundIds.join("|")

  useEffect(() => {
    if (currentId && rotation.backgroundIds.includes(currentId)) return
    setCurrentId(rotation.backgroundIds[0] ?? null)
  }, [poolKey, currentId, rotation.backgroundIds])

  useEffect(() => {
    if (!timed || rotation.backgroundIds.length === 0) {
      setDueAt(null)
      return
    }
    const delay = nextDelayMs(rotation)
    setDueAt(Date.now() + delay)
    const timer = window.setTimeout(() => setCurrentId((id) => pickNext(rotation, id)), delay)
    return () => window.clearTimeout(timer)
  }, [timed, rotation, currentId])

  useEffect(() => {
    if (dueAt === null) return
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [dueAt])

  const fire = () => setCurrentId((id) => pickNext(rotation, id))
  const secondsLeft = dueAt === null ? null : Math.max(0, Math.ceil((dueAt - now) / 1000))
  return { currentId, secondsLeft, fire }
}

export function BackgroundRotationPanel({ table }: { table: StudioAsset }) {
  const { assets, updateRotation, toggleRotationBackground } = useStudio()
  const fieldId = useId()
  const rotation = table.rotation ?? DEFAULT_ROTATION
  const backgrounds = assets.filter((item) => item.kind === "background")
  const { currentId, secondsLeft, fire } = useRotationPreview(rotation)
  const current = backgrounds.find((item) => item.id === currentId) ?? null
  const active = rotation.mode !== "off"
  const timed = rotation.mode === "random" || rotation.mode === "sequence"

  return (
    <div className="flex flex-col gap-2 rounded-md border border-sg-line bg-sg-bg/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">Bakgrundsbyte</span>
        <div role="radiogroup" aria-label="Läge för bakgrundsbyte" className="flex rounded border border-sg-line p-0.5">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={rotation.mode === mode}
              title={ROTATION_MODES[mode].hint}
              onClick={() => updateRotation(table.id, { mode })}
              className={cn(
                "rounded-sm px-1.5 py-0.5 text-[10px] transition-colors",
                rotation.mode === mode ? "bg-sg-lime/15 text-sg-lime" : "text-sg-muted hover:text-sg-text",
              )}
            >
              {ROTATION_MODES[mode].label}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <>
          <div role="group" aria-label="Bakgrunder i rotationen" className="flex flex-wrap gap-1">
            {backgrounds.map((bg) => {
              const included = rotation.backgroundIds.includes(bg.id)
              return (
                <button
                  key={bg.id}
                  type="button"
                  aria-pressed={included}
                  onClick={() => toggleRotationBackground(table.id, bg.id)}
                  className={cn(
                    "flex items-center gap-1 rounded border py-0.5 pl-0.5 pr-1.5 text-[10px] transition-colors",
                    included ? "border-sg-lime/60 bg-sg-lime/10 text-sg-lime" : "border-sg-line text-sg-muted hover:text-sg-text",
                  )}
                >
                  <MediaThumb asset={bg} className="h-4 w-7 rounded-sm" />
                  {bg.name}
                  {bg.isVideo && <Film className="size-2.5" aria-label="video" />}
                </button>
              )
            })}
          </div>

          {timed && (
            <div className="flex items-end gap-3">
              <NumberField
                id={`${fieldId}-interval`}
                label="Var (s)"
                value={rotation.intervalSec}
                min={ROTATION_INTERVAL.min}
                max={ROTATION_INTERVAL.max}
                onChange={(intervalSec) => updateRotation(table.id, { intervalSec })}
              />
              <NumberField
                id={`${fieldId}-jitter`}
                label="± slump (s)"
                value={rotation.jitterSec}
                min={0}
                max={Math.floor(rotation.intervalSec / 2)}
                onChange={(jitterSec) => updateRotation(table.id, { jitterSec })}
              />
            </div>
          )}

          {rotation.mode === "openclaw" && (
            <p className="flex items-center gap-1.5 text-[10px] text-sg-muted">
              <Bot className="size-3 text-sg-teal" aria-hidden />
              <span>
                {"Agenten skickar "}
                <code className="font-mono text-sg-text">{rotationEvent(table.id)}</code>
              </span>
            </p>
          )}

          <div className="flex items-center gap-2 border-t border-sg-line pt-2">
            {current ? (
              <MediaThumb asset={current} className="h-9 w-16 rounded" />
            ) : (
              <div className="h-9 w-16 rounded border border-dashed border-sg-line" />
            )}
            <div className="min-w-0 flex-1 text-[10px] leading-tight">
              <p className="truncate text-sg-text">{current ? `Nu: ${current.name}` : "Välj minst en bakgrund"}</p>
              <p className="font-mono text-sg-muted" aria-live="polite">
                {timed && secondsLeft !== null ? `byte om ${secondsLeft} s` : rotation.mode === "openclaw" ? "väntar på agent" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={fire}
              disabled={rotation.backgroundIds.length < 2}
              className="flex items-center gap-1 rounded border border-sg-line px-1.5 py-1 text-[10px] text-sg-muted transition-colors hover:text-sg-text disabled:opacity-40"
            >
              <Shuffle className="size-3" aria-hidden />
              {rotation.mode === "openclaw" ? "Simulera event" : "Byt nu"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const next = Number(draft)
    if (draft.trim() !== "" && Number.isFinite(next)) onChange(next)
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-[9px] uppercase tracking-wider text-sg-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={draft ?? value}
        min={min}
        max={max}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) commit()
        }}
        className="w-16 rounded border border-sg-line bg-sg-panel px-1.5 py-0.5 font-mono text-[11px] text-sg-text outline-none focus:border-sg-lime"
      />
    </div>
  )
}

export function MediaThumb({ asset, className }: { asset: StudioAsset; className?: string }) {
  if (!asset.src) return <div className={cn("bg-sg-line", className)} />
  return asset.isVideo ? (
    <video src={asset.src} className={cn("object-cover", className)} muted loop={asset.loop} autoPlay playsInline />
  ) : (
    <img src={asset.src || "/placeholder.svg"} alt="" className={cn("object-cover", className)} />
  )
}
