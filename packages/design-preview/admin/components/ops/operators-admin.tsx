"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { Pause, Play, Plus, Trash2 } from "lucide-react"
import { useStudio } from "@/components/studio/studio-provider"
import type { Operator } from "@/lib/studio-hierarchy"
import { Page, PageHeader, Panel, SmallButton, Td, Th, inputClass } from "./ui"
import { cn } from "@/lib/utils"

export function OperatorsAdmin() {
  const studio = useStudio()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    const result = studio.addEntity("operator", name)
    if (result.ok) {
      setName("")
      setError(null)
    } else setError(result.error)
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Admin · Nivå 1"
        title="Spelbolag"
        description="Lägg till, pausa eller radera spelbolag. Spel, rum och dealers byggs i Studio › Struktur, andelar sätts i Ekonomi. Radering tar bort allt under bolaget och protokollförs."
      />

      <Panel
        title="Alla spelbolag"
        meta={`${studio.operators.length} st`}
        action={
          <form onSubmit={handleAdd} className="flex items-center gap-1.5">
            <label htmlFor="new-operator" className="sr-only">
              Nytt spelbolag
            </label>
            <input id="new-operator" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nytt spelbolag" className={inputClass} />
            <SmallButton type="submit" tone="primary">
              <Plus className="size-3" aria-hidden />
              Lägg till
            </SmallButton>
            {error && (
              <span role="alert" className="text-[11px] text-sg-amber">
                {error}
              </span>
            )}
          </form>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Spelbolag</Th>
                <Th>Licens</Th>
                <Th>Status</Th>
                <Th className="text-right">Spel</Th>
                <Th className="text-right">Rum</Th>
                <Th className="text-right">Dealers</Th>
                <Th className="text-right">Åtgärder</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {studio.operators.map((operator) => (
                <OperatorRow
                  key={operator.id}
                  operator={operator}
                  confirming={deleting === operator.id}
                  onAskDelete={() => setDeleting(operator.id)}
                  onCancelDelete={() => setDeleting(null)}
                />
              ))}
            </tbody>
          </table>
          {studio.operators.length === 0 && <p className="px-4 py-6 text-xs text-sg-muted">Inga spelbolag.</p>}
        </div>
      </Panel>
    </Page>
  )
}

function OperatorRow({
  operator,
  confirming,
  onAskDelete,
  onCancelDelete,
}: {
  operator: Operator
  confirming: boolean
  onAskDelete: () => void
  onCancelDelete: () => void
}) {
  const studio = useStudio()
  const games = studio.games.filter((game) => game.operatorId === operator.id)
  const rooms = studio.rooms.filter((room) => games.some((game) => game.id === room.gameId))
  const dealers = studio.dealers.filter((item) => rooms.some((room) => room.id === item.roomId))
  const paused = operator.status === "paused"

  const toggleStatus = () => {
    const reason = window.prompt(paused ? `Anledning till att aktivera ${operator.name}:` : `Anledning till att pausa ${operator.name}:`)
    if (reason?.trim()) studio.setOperatorStatus(operator.id, paused ? "active" : "paused", reason.trim())
  }

  return (
    <>
      <tr className={cn(confirming && "bg-sg-red/5")}>
        <Td>
          <button
            type="button"
            onClick={() => studio.select("operator", operator.id)}
            className="font-medium hover:text-sg-lime"
          >
            {operator.name}
          </button>
        </Td>
        <Td className="font-mono text-sg-muted">{operator.license}</Td>
        <Td>
          <span className={cn("inline-flex items-center gap-1.5", paused ? "text-sg-amber" : "text-sg-lime")}>
            <span className={cn("size-1.5 rounded-full", paused ? "bg-sg-amber" : "bg-sg-lime")} aria-hidden />
            {paused ? "Pausad" : "Aktiv"}
          </span>
        </Td>
        <Td className="text-right font-mono tabular-nums">{games.length}</Td>
        <Td className="text-right font-mono tabular-nums">{rooms.length}</Td>
        <Td className="text-right font-mono tabular-nums">{dealers.length}</Td>
        <Td className="text-right">
          <span className="inline-flex gap-1.5">
            <SmallButton onClick={toggleStatus}>
              {paused ? <Play className="size-3" aria-hidden /> : <Pause className="size-3" aria-hidden />}
              {paused ? "Aktivera" : "Pausa"}
            </SmallButton>
            <SmallButton tone="danger" onClick={onAskDelete} disabled={confirming}>
              <Trash2 className="size-3" aria-hidden />
              Radera
            </SmallButton>
          </span>
        </Td>
      </tr>
      {confirming && (
        <tr className="bg-sg-red/5">
          <td colSpan={7} className="px-4 pb-4">
            <DeleteConfirm
              operator={operator}
              summary={`${games.length} spel, ${rooms.length} rum, ${dealers.length} dealers och alla andelsundantag tas bort.`}
              onCancel={onCancelDelete}
            />
          </td>
        </tr>
      )}
    </>
  )
}

function DeleteConfirm({ operator, summary, onCancel }: { operator: Operator; summary: string; onCancel: () => void }) {
  const studio = useStudio()
  const [typed, setTyped] = useState("")
  const [reason, setReason] = useState("")
  const matches = typed.trim() === operator.name
  const fieldId = `delete-${operator.id}`

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!matches || !reason.trim()) return
    studio.removeEntity("operator", operator.id, reason.trim())
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-sg-red/40 bg-sg-bg p-3">
      <p className="text-xs">
        <span className="font-semibold text-sg-red">{`Radera ${operator.name}? `}</span>
        <span className="text-sg-muted">{summary} Journal och avräkningar ligger kvar enligt lagkrav. </span>
        <Link href="/admin/admin/payments" className="text-sg-muted underline underline-offset-2 hover:text-sg-text">
          Se avräkningar
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor={`${fieldId}-name`} className="text-xs text-sg-muted">
          {"Skriv "}
          <span className="font-mono text-sg-text">{operator.name}</span>
          {" för att bekräfta"}
        </label>
        <input id={`${fieldId}-name`} autoFocus value={typed} onChange={(event) => setTyped(event.target.value)} className={cn(inputClass, "w-40")} />
        <label htmlFor={`${fieldId}-reason`} className="sr-only">
          Anledning
        </label>
        <input id={`${fieldId}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Anledning (protokoll)" className={cn(inputClass, "w-56")} />
        <SmallButton type="submit" tone="danger" disabled={!matches || !reason.trim()}>
          Radera permanent
        </SmallButton>
        <SmallButton onClick={onCancel}>Avbryt</SmallButton>
      </div>
    </form>
  )
}
