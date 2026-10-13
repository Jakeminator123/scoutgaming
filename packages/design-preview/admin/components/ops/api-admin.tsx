"use client"

import { useState } from "react"
import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { SERVICES, seeded } from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Page, PageHeader, Panel, SmallButton, StatusBadge, Td, Th } from "./ui"
import { cn } from "@/lib/utils"

const WEBHOOK_EVENTS = ["round.settled", "player.flagged", "invoice.issued"]

const keyPrefix = (seed: string) => `sg_live_${Math.floor(seeded(seed) * 0xffffff).toString(16).padStart(6, "0")}`

export function ApiAdmin() {
  const studio = useStudio()
  const [rotations, setRotations] = useState<Record<string, number>>({})
  const [revoked, setRevoked] = useState<Set<string>>(new Set())
  const gameApi = SERVICES.find((service) => service.id === "game-api")

  const rotate = (operatorId: string, name: string) => {
    if (!window.confirm(`Rotera nyckeln för ${name}? Den gamla slutar gälla om 24 h.`)) return
    setRotations((current) => ({ ...current, [operatorId]: (current[operatorId] ?? 0) + 1 }))
    setRevoked((current) => {
      const next = new Set(current)
      next.delete(operatorId)
      return next
    })
    studio.log("API", `Roterade API-nyckel för ${name}`)
  }

  const revoke = (operatorId: string, name: string) => {
    const reason = window.prompt(`Anledning till att spärra nyckeln för ${name}:`)
    if (!reason?.trim()) return
    setRevoked((current) => new Set(current).add(operatorId))
    studio.log("API", `Spärrade API-nyckel för ${name}`, reason.trim())
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Admin · Nivå 1"
        title="API & integrationer"
        description="En nyckel och en webhook per spelbolag. Tjänsternas hälsa visas i Drift, här hanteras bara åtkomsten."
        aside={
          gameApi && (
            <Link href="/admin/drift" className="flex items-center gap-2 rounded-md border border-sg-line bg-sg-panel px-3 py-2 text-xs hover:border-sg-lime/50">
              <span className="text-sg-muted">Spel-API</span>
              <StatusBadge status={gameApi.status} />
            </Link>
          )
        }
      />

      <Panel title="Nycklar & webhooks" meta={`${studio.operators.length} spelbolag`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Spelbolag</Th>
                <Th>Nyckel</Th>
                <Th>Senast använd</Th>
                <Th>Webhook</Th>
                <Th>Leverans 24 h</Th>
                <Th className="text-right">Åtgärder</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {studio.operators.map((operator) => {
                const rotation = rotations[operator.id] ?? 0
                const isRevoked = revoked.has(operator.id)
                const delivered = 0.97 + seeded(`${operator.id}:wh`) * 0.03
                const host = operator.name.toLowerCase().replace(/[^a-z0-9]+/g, "")
                return (
                  <tr key={operator.id}>
                    <Td className="font-medium">{operator.name}</Td>
                    <Td>
                      <code className={cn("font-mono", isRevoked ? "text-sg-red line-through" : "text-sg-text")}>
                        {`${keyPrefix(`${operator.id}:${rotation}`)}••••`}
                      </code>
                      {isRevoked && <span className="ml-2 text-[11px] text-sg-red">Spärrad</span>}
                    </Td>
                    <Td className="font-mono text-sg-muted">{isRevoked ? "–" : `${Math.ceil(seeded(operator.id) * 50)} s sedan`}</Td>
                    <Td>
                      <code className="font-mono text-[11px] text-sg-muted">{`https://api.${host}.com/hooks/scout`}</code>
                      <span className="block text-[10px] text-sg-muted">{WEBHOOK_EVENTS.join(" · ")}</span>
                    </Td>
                    <Td className={cn("font-mono tabular-nums", delivered < 0.99 ? "text-sg-amber" : "text-sg-lime")}>
                      {`${(delivered * 100).toFixed(1).replace(".", ",")} %`}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex gap-1.5">
                        <SmallButton onClick={() => rotate(operator.id, operator.name)}>
                          <RefreshCw className="size-3" aria-hidden />
                          Rotera
                        </SmallButton>
                        <SmallButton tone="danger" disabled={isRevoked} onClick={() => revoke(operator.id, operator.name)}>
                          Spärra
                        </SmallButton>
                      </span>
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
