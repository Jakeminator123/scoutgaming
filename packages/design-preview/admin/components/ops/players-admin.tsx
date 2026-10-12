"use client"

import { useState } from "react"
import { seeded } from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Kpis, Page, PageHeader, Panel, SmallButton, Td, Th } from "./ui"
import { cn } from "@/lib/utils"

type FlagStatus = "open" | "reviewed" | "blocked"

const SIGNALS = [
  "Misstänkt samspel: två konton vid samma bord",
  "Botmönster: identisk reaktionstid 40 rundor",
  "Kortsräkning: insats följer räkning",
  "Försök att spela under Spelpaus",
  "Ovanlig insatsökning efter förlust",
]

const STATUS_META: Record<FlagStatus, { label: string; className: string }> = {
  open: { label: "Öppen", className: "text-sg-amber" },
  reviewed: { label: "Granskad", className: "text-sg-muted" },
  blocked: { label: "Spärrad", className: "text-sg-red" },
}

export function PlayersAdmin() {
  const studio = useStudio()
  const flags = studio.rooms.flatMap((room, roomIndex) => {
    const game = studio.games.find((item) => item.id === room.gameId)
    const operator = studio.operators.find((item) => item.id === game?.operatorId)
    const count = 1 + Math.floor(seeded(`${room.id}:flags`) * 2)
    return Array.from({ length: count }, (_, index) => {
      const roll = seeded(`${room.id}:flag:${index}`)
      return {
        id: `${room.id}-${index}`,
        player: `${(operator?.name ?? "XX").slice(0, 2).toUpperCase()}-${Math.floor(10000 + roll * 89999)}`,
        operator: operator?.name ?? "?",
        room: room.name,
        signal: SIGNALS[(roomIndex + index) % SIGNALS.length],
        score: Math.round(55 + roll * 44),
        at: `12/10 ${String(8 + Math.floor(roll * 6)).padStart(2, "0")}:${String(Math.floor(roll * 59)).padStart(2, "0")}`,
      }
    })
  })
  const [statuses, setStatuses] = useState<Record<string, FlagStatus>>({})
  const statusOf = (id: string) => statuses[id] ?? "open"
  const open = flags.filter((flag) => statusOf(flag.id) === "open")

  const decide = (flag: (typeof flags)[number], status: FlagStatus) => {
    setStatuses((current) => ({ ...current, [flag.id]: status }))
    studio.log("Integritet", `${flag.player} (${flag.operator}): ${STATUS_META[status].label.toLowerCase()}`, flag.signal)
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Admin · Nivå 1"
        title="Spelare & integritet"
        description="Signaler från bord och spelmönster som behöver ett beslut. Spelare visas med pseudonym, identitet finns hos spelbolaget. Beslut protokollförs och skickas till bolaget via webhook."
      />
      <Kpis
        items={[
          { label: "Öppna ärenden", value: String(open.length), tone: open.length ? "amber" : "lime" },
          { label: "Spelpaus-spärrar", value: "312", hint: "Blockerade inloggningar 30 d" },
          { label: "Insatsgränser nådda", value: "1 284", hint: "Spelarens egna gränser, 30 d" },
          { label: "Snitt tid till beslut", value: "3 h 12 min", hint: "Mål: under 24 h" },
        ]}
      />
      <Panel title="Ärenden" meta="Sorterat på risk">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Spelare</Th>
                <Th>Signal</Th>
                <Th className="text-right">Risk</Th>
                <Th>Tid</Th>
                <Th>Status</Th>
                <Th className="text-right">Beslut</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {[...flags]
                .sort((a, b) => b.score - a.score)
                .map((flag) => {
                  const status = statusOf(flag.id)
                  return (
                    <tr key={flag.id} className={cn(status !== "open" && "opacity-60")}>
                      <Td>
                        <span className="font-mono font-medium">{flag.player}</span>
                        <span className="block text-[11px] text-sg-muted">{`${flag.operator} · ${flag.room}`}</span>
                      </Td>
                      <Td>{flag.signal}</Td>
                      <Td className={cn("text-right font-mono tabular-nums", flag.score >= 85 ? "text-sg-red" : "text-sg-amber")}>
                        {flag.score}
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-sg-muted">{flag.at}</Td>
                      <Td className={STATUS_META[status].className}>{STATUS_META[status].label}</Td>
                      <Td className="text-right">
                        {status === "open" ? (
                          <span className="inline-flex gap-1.5">
                            <SmallButton onClick={() => decide(flag, "reviewed")}>Granskad, ok</SmallButton>
                            <SmallButton tone="danger" onClick={() => decide(flag, "blocked")}>
                              Spärra
                            </SmallButton>
                          </span>
                        ) : (
                          <SmallButton onClick={() => setStatuses((current) => ({ ...current, [flag.id]: "open" }))}>Öppna igen</SmallButton>
                        )}
                      </Td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  )
}
