"use client"

import { useId, useState, type FormEvent, type ReactNode } from "react"
import { Check, Pencil, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">{children}</div>
}

export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string
  title: string
  description: string
  aside?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">{`// ${eyebrow}`}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-sg-muted">{description}</p>
      </div>
      {aside}
    </header>
  )
}

export function Panel({
  title,
  meta,
  action,
  children,
  className,
}: {
  title: string
  meta?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-sg-line bg-sg-panel", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-sg-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          {title}
          {meta && <span className="ml-2 font-mono text-[10px] font-normal text-sg-muted">{meta}</span>}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Kpis({ items }: { items: { label: string; value: string; hint?: string; tone?: "lime" | "amber" | "red" }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-sg-line bg-sg-panel px-4 py-3">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-sg-muted">{item.label}</dt>
          <dd
            className={cn(
              "mt-1 text-xl font-semibold tabular-nums",
              item.tone === "lime" && "text-sg-lime",
              item.tone === "amber" && "text-sg-amber",
              item.tone === "red" && "text-sg-red",
            )}
          >
            {item.value}
          </dd>
          {item.hint && <dd className="mt-0.5 text-[11px] text-sg-muted">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-4 py-2 text-left font-mono text-[10px] font-normal uppercase tracking-wider text-sg-muted", className)}>
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>
}

export function SmallButton({
  className,
  tone = "default",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "primary" | "danger" }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        tone === "default" && "border-sg-line text-sg-text hover:bg-sg-bg",
        tone === "primary" && "border-sg-lime bg-sg-lime text-sg-bg hover:bg-sg-lime/90",
        tone === "danger" && "border-sg-red/50 text-sg-red hover:bg-sg-red/10",
        className,
      )}
      {...props}
    />
  )
}

export const inputClass =
  "rounded-md border border-sg-line bg-sg-bg px-2 py-1 text-xs text-sg-text outline-none placeholder:text-sg-muted focus:border-sg-lime/60"

export function PercentEditor({
  value,
  onSave,
  label,
  disabled,
  max = 50,
  suffix,
}: {
  value: number
  onSave: (pct: number, reason: string) => void
  label: string
  disabled?: boolean
  max?: number
  suffix?: ReactNode
}) {
  const fieldId = useId()
  const [editing, setEditing] = useState(false)
  const [pct, setPct] = useState(String(value))
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setEditing(false)
    setError(null)
    setReason("")
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = Number(pct.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return setError(`0–${max} %`)
    if (!reason.trim()) return setError("Ange anledning för protokollet")
    onSave(Math.round(parsed * 10) / 10, reason.trim())
    close()
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-mono text-sm tabular-nums">{`${value} %`}</span>
        {suffix}
        {!disabled && (
          <button
            type="button"
            aria-label={`Ändra ${label}`}
            title={`Ändra ${label}`}
            onClick={() => {
              setPct(String(value))
              setEditing(true)
            }}
            className="rounded p-1 text-sg-muted hover:text-sg-lime"
          >
            <Pencil className="size-3" aria-hidden />
          </button>
        )}
      </span>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor={`${fieldId}-pct`}>{`${label} i procent`}</label>
      <input
        id={`${fieldId}-pct`}
        autoFocus
        inputMode="decimal"
        value={pct}
        onChange={(event) => setPct(event.target.value)}
        className={cn(inputClass, "w-14 font-mono")}
      />
      <span className="text-xs text-sg-muted">%</span>
      <label className="sr-only" htmlFor={`${fieldId}-reason`}>Anledning</label>
      <input
        id={`${fieldId}-reason`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && close()}
        placeholder="Anledning (protokoll)"
        className={cn(inputClass, "w-44")}
      />
      <button type="submit" aria-label="Spara" className="rounded p-1 text-sg-lime">
        <Check className="size-3.5" aria-hidden />
      </button>
      <button type="button" aria-label="Avbryt" onClick={close} className="rounded p-1 text-sg-muted">
        <X className="size-3.5" aria-hidden />
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-sg-amber">
          {error}
        </span>
      )}
    </form>
  )
}
