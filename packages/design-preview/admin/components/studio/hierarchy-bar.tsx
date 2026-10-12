"use client"

import { useState, type FormEvent } from "react"
import { Check, ChevronRight, Plus, Trash2, X } from "lucide-react"
import { LEVEL_META, type Level } from "@/lib/studio-hierarchy"
import { DEALER_KINDS, type DealerKind } from "@/lib/studio-assets"
import { useStudio } from "./studio-provider"
import { cn } from "@/lib/utils"

type EntityLevel = Level | "dealer"
type Option = { id: string; name: string }

export function HierarchyBar() {
  const studio = useStudio()

  const segments: { level: EntityLevel; options: Option[]; active: Option | null; parentReady: boolean }[] = [
    { level: "operator", options: studio.operators, active: studio.activeOperator, parentReady: true },
    { level: "game", options: studio.gamesInOperator, active: studio.activeGame, parentReady: !!studio.activeOperator },
    { level: "room", options: studio.roomsInGame, active: studio.activeRoom, parentReady: !!studio.activeGame },
    { level: "dealer", options: studio.dealersInRoom, active: studio.activeDealer, parentReady: !!studio.activeRoom },
  ]

  return (
    <nav aria-label="Hierarki" className="border-b border-sg-line bg-sg-panel/60 px-6 py-2.5">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {segments.map((segment, index) => (
          <li key={segment.level} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3.5 text-sg-line" aria-hidden />}
            <Segment {...segment} />
          </li>
        ))}
      </ol>
    </nav>
  )
}

function Segment({
  level,
  options,
  active,
  parentReady,
}: {
  level: EntityLevel
  options: Option[]
  active: Option | null
  parentReady: boolean
}) {
  const { select, addEntity, removeEntity } = useStudio()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [dealerKind, setDealerKind] = useState<DealerKind>("standard")
  const meta = LEVEL_META[level]
  const fieldId = `segment-${level}`

  const closeForm = () => {
    setAdding(false)
    setName("")
    setError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = addEntity(level, name, { dealerKind })
    if (result.ok) closeForm()
    else setError(result.error)
  }

  const handleRemove = () => {
    if (!active) return
    const cascade = level === "dealer" ? "" : " och allt under"
    if (window.confirm(`Ta bort ${meta.label.toLowerCase()} "${active.name}"${cascade}?`)) removeEntity(level, active.id)
  }

  return (
    <div className="relative flex items-center gap-1 rounded-md border border-sg-line bg-sg-bg py-0.5 pl-2 pr-0.5">
      <label htmlFor={fieldId} className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">
        {meta.label}
      </label>

      {adding ? (
        <form onSubmit={handleSubmit} className="flex items-center">
          <input
            id={fieldId}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && closeForm()}
            placeholder={meta.placeholder}
            className="w-32 bg-transparent px-1.5 py-1 text-xs text-sg-text outline-none placeholder:text-sg-muted"
          />
          {level === "dealer" && (
            <>
              <label htmlFor={`${fieldId}-kind`} className="sr-only">
                Dealertyp
              </label>
              <select
                id={`${fieldId}-kind`}
                value={dealerKind}
                onChange={(event) => setDealerKind(event.target.value as DealerKind)}
                title={DEALER_KINDS[dealerKind].hint}
                className="rounded bg-sg-panel px-1 py-1 text-[11px] text-sg-text outline-none"
              >
                {Object.entries(DEALER_KINDS).map(([kind, meta]) => (
                  <option key={kind} value={kind}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <IconButton type="submit" label={`Spara ${meta.label.toLowerCase()}`}>
            <Check className="size-3.5" aria-hidden />
          </IconButton>
          <IconButton label="Avbryt" onClick={closeForm}>
            <X className="size-3.5" aria-hidden />
          </IconButton>
        </form>
      ) : (
        <>
          <select
            id={fieldId}
            value={active?.id ?? ""}
            disabled={options.length === 0}
            onChange={(event) => select(level, event.target.value)}
            className={cn(
              "max-w-44 cursor-pointer bg-transparent py-1 pl-1 pr-1 text-xs font-medium outline-none disabled:cursor-default",
              options.length === 0 ? "text-sg-muted" : "text-sg-text",
            )}
          >
            {options.length === 0 && <option value="">{parentReady ? `Inga ${meta.plural.toLowerCase()}` : "–"}</option>}
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <IconButton
            label={`Lägg till ${meta.label.toLowerCase()}`}
            disabled={!parentReady}
            onClick={() => setAdding(true)}
            className="hover:text-sg-lime"
          >
            <Plus className="size-3.5" aria-hidden />
          </IconButton>
          <IconButton
            label={active ? `Ta bort ${active.name}` : `Ta bort ${meta.label.toLowerCase()}`}
            disabled={!active}
            onClick={handleRemove}
            className="hover:text-sg-red"
          >
            <Trash2 className="size-3" aria-hidden />
          </IconButton>
        </>
      )}

      {error && (
        <p role="alert" className="absolute left-0 top-full z-10 mt-1 whitespace-nowrap rounded bg-sg-panel px-2 py-1 text-[11px] text-sg-amber shadow">
          {error}
        </p>
      )}
    </div>
  )
}

function IconButton({
  label,
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "rounded p-1 text-sg-muted transition-colors disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
      {...props}
    />
  )
}
