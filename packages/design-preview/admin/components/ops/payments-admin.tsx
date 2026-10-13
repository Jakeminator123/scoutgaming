"use client"

import { useMemo, useState } from "react"
import { Check, ShieldCheck } from "lucide-react"
import { computeEconomy, formatSek, seeded } from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Page, PageHeader, Panel, SmallButton, Td, Th } from "./ui"
import { cn } from "@/lib/utils"

const PERIODS = [
  { id: "2026-10", label: "Okt 2026", status: "Pågår", factor: 1 },
  { id: "2026-09", label: "Sep 2026", status: "Betald", factor: 0.94 },
  { id: "2026-08", label: "Aug 2026", status: "Betald", factor: 0.88 },
]

const OUTCOMES = ["Spelare 20 – Dealer 19", "Dealer bust 23", "Blackjack spelare", "Dealer 20 – push", "Banker 7 – Player 5", "Player 9 natural"]

const hex = (key: string) =>
  Array.from({ length: 8 }, (_, index) => Math.floor(seeded(`${key}:${index}`) * 16).toString(16)).join("")

export function PaymentsAdmin() {
  const studio = useStudio()
  const rows = useMemo(() => computeEconomy({ ...studio }, studio.terms), [studio])
  const [verified, setVerified] = useState<Set<string>>(new Set())

  const invoices = studio.operators.flatMap((operator) => {
    const take = rows.filter((row) => row.operatorId === operator.id).reduce((sum, row) => sum + row.take, 0)
    return PERIODS.map((period) => ({
      id: `${operator.id}-${period.id}`,
      operator: operator.name,
      period,
      amount: period.factor === 1 ? take : take * period.factor * (0.92 + 0.16 * seeded(`${operator.id}:${period.id}`)),
    }))
  })

  const payouts = rows
    .filter((row) => row.payout > 0)
    .map((row) => ({ id: row.dealer.id, name: row.dealer.name, pct: row.dealer.revsharePct, amount: row.payout }))

  const journal = studio.rooms.flatMap((room) => {
    const dealer = studio.dealers.find((item) => item.roomId === room.id)
    return Array.from({ length: 3 }, (_, index) => {
      const roll = seeded(`${room.id}:round:${index}`)
      const bets = Math.round(400 + roll * 9000)
      return {
        id: `R-${Math.floor(100000 + seeded(`${room.id}:${index}:id`) * 899999)}`,
        at: `14:${String(59 - index * 3 - Math.floor(roll * 3)).padStart(2, "0")}`,
        room: room.name,
        dealer: dealer?.name ?? "–",
        outcome: OUTCOMES[Math.floor(roll * OUTCOMES.length)],
        bets,
        payout: Math.round(bets * (0.6 + roll * 0.8)),
        commit: hex(`${room.id}:${index}`),
      }
    })
  }).sort((a, b) => b.at.localeCompare(a.at))

  return (
    <Page>
      <PageHeader
        eyebrow="Admin · Nivå 1"
        title="Betalningar & journal"
        description="Avräkning mot spelbolagen bygger på andelarna i Ekonomi. Journalen är rundhistoriken som tillsynsmyndigheten kan begära ut, med RNG-commit per runda som kan verifieras i efterhand."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Avräkning från spelbolag" meta="Fakturor, vår andel">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-sg-line">
                <tr>
                  <Th>Spelbolag</Th>
                  <Th>Period</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Belopp</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sg-line">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <Td className="font-medium">{invoice.operator}</Td>
                    <Td className="font-mono text-sg-muted">{invoice.period.label}</Td>
                    <Td className={invoice.period.status === "Pågår" ? "text-sg-amber" : "text-sg-lime"}>{invoice.period.status}</Td>
                    <Td className="text-right font-mono tabular-nums">{formatSek(invoice.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Utbetalning till dealers" meta="Revshare, innevarande period">
          <ul className="divide-y divide-sg-line">
            {payouts.length === 0 && <li className="px-4 py-6 text-xs text-sg-muted">Ingen dealer har revshare.</li>}
            {payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span>
                  <span className="font-medium">{payout.name}</span>
                  <span className="ml-2 font-mono text-sg-muted">{`${payout.pct} % av GGR`}</span>
                </span>
                <span className="font-mono tabular-nums text-sg-amber">{formatSek(payout.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Rundjournal" meta="Senaste rundorna · WORM-lagrad">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Runda</Th>
                <Th>Tid</Th>
                <Th>Rum</Th>
                <Th>Utfall</Th>
                <Th className="text-right">Insatser</Th>
                <Th className="text-right">Vinster</Th>
                <Th>RNG-commit</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {journal.map((round) => {
                const isVerified = verified.has(round.id)
                return (
                  <tr key={round.id}>
                    <Td className="font-mono">{round.id}</Td>
                    <Td className="font-mono text-sg-muted">{round.at}</Td>
                    <Td>
                      {round.room}
                      <span className="block text-[11px] text-sg-muted">{round.dealer}</span>
                    </Td>
                    <Td>{round.outcome}</Td>
                    <Td className="text-right font-mono tabular-nums">{formatSek(round.bets)}</Td>
                    <Td className="text-right font-mono tabular-nums">{formatSek(round.payout)}</Td>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <code className="font-mono text-[11px] text-sg-muted">{`${round.commit}…`}</code>
                        {isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-sg-lime">
                            <Check className="size-3" aria-hidden />
                            Stämmer
                          </span>
                        ) : (
                          <SmallButton
                            onClick={() => setVerified((current) => new Set(current).add(round.id))}
                            className={cn("px-1.5 py-0.5 text-[11px]")}
                          >
                            <ShieldCheck className="size-3" aria-hidden />
                            Verifiera
                          </SmallButton>
                        )}
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
