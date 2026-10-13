"use client"

import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import {
  CERT_WARNING_BEFORE,
  INCIDENTS,
  RNGS,
  SERVICES,
  STATUS_META,
  formatAt,
  renderNodeForRoom,
  rngForGame,
  seeded,
  uptimeTicks,
  type ServiceStatus,
} from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Kpis, Page, PageHeader, Panel, StatusBadge, Td, Th } from "./ui"
import { cn } from "@/lib/utils"

type RoomState = { label: string; status: ServiceStatus | "idle" }

export function DriftView() {
  const studio = useStudio()

  const rooms = studio.rooms.map((room) => {
    const game = studio.games.find((item) => item.id === room.gameId)
    const operator = studio.operators.find((item) => item.id === game?.operatorId)
    const dealers = studio.dealers.filter((item) => item.roomId === room.id)
    const onAir = dealers[0] ?? null
    const node = renderNodeForRoom(room.id)
    const rng = rngForGame(game?.kind ?? "")
    const state: RoomState =
      operator?.status === "paused"
        ? { label: "Pausad", status: "idle" }
        : !onAir
          ? { label: "Ingen dealer", status: "idle" }
          : node.status !== "up"
            ? { label: "Störd", status: node.status }
            : { label: "Live", status: "up" }
    const live = state.status !== "idle"
    const players = live ? Math.round(2 + seeded(`${room.id}:p`) * (room.seats - 2)) : 0
    const roundsPerHour = live ? Math.round((state.status === "up" ? 52 : 31) + seeded(`${room.id}:r`) * 12) : 0
    return { room, game, operator, onAir, node, rng, state, players, roundsPerHour }
  })

  const liveRooms = rooms.filter((item) => item.state.status !== "idle")
  const troubled = [...SERVICES, ...RNGS].filter((item) => item.status !== "up")
  const seated = liveRooms.reduce((sum, item) => sum + item.players, 0)
  const seats = liveRooms.reduce((sum, item) => sum + item.room.seats, 0)

  return (
    <Page>
      <PageHeader
        eyebrow="Drift · Översikt"
        title={troubled.length === 0 ? "Alla system uppe" : `${troubled.length} system med störning`}
        description="Live-läge för alla rum, renderingsnoder, slumpgeneratorer och tjänster. Rum ärver status från noden de renderas på. Exempeldata."
      />

      <Kpis
        items={[
          { label: "Rum live", value: `${liveRooms.length}/${rooms.length}`, hint: "Pausade bolag räknas inte" },
          { label: "Spelare vid bord", value: `${seated}/${seats}`, hint: seats ? `${Math.round((seated / seats) * 100)} % beläggning` : "–" },
          {
            label: "Rundor / timme",
            value: String(liveRooms.reduce((sum, item) => sum + item.roundsPerHour, 0)),
            hint: "Summa över alla rum",
          },
          {
            label: "Störningar",
            value: String(troubled.length),
            hint: troubled.map((item) => item.name).join(", ") || "Inga",
            tone: troubled.length ? "amber" : "lime",
          },
        ]}
      />

      <Panel title="Rum" meta={`${rooms.length} st · från Studio › Struktur`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Rum</Th>
                <Th>Status</Th>
                <Th>Dealer i sändning</Th>
                <Th className="text-right">Spelare</Th>
                <Th className="text-right">Rundor/h</Th>
                <Th>Render</Th>
                <Th>RNG</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {rooms.map((item) => (
                <tr key={item.room.id}>
                  <Td>
                    <span className="font-medium">{item.room.name}</span>
                    <span className="block text-[11px] text-sg-muted">{`${item.operator?.name ?? "?"} · ${item.game?.name ?? "?"}`}</span>
                  </Td>
                  <Td>
                    {item.state.status === "idle" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-sg-muted">
                        <span className="size-1.5 rounded-full bg-sg-muted" aria-hidden />
                        {item.state.label}
                      </span>
                    ) : (
                      <StatusBadge status={item.state.status} label={item.state.label} />
                    )}
                  </Td>
                  <Td>{item.onAir?.name ?? <span className="text-sg-muted">–</span>}</Td>
                  <Td className="text-right font-mono tabular-nums">{`${item.players}/${item.room.seats}`}</Td>
                  <Td className="text-right font-mono tabular-nums">{item.roundsPerHour || "–"}</Td>
                  <Td>
                    <span className={cn("font-mono", STATUS_META[item.node.status].text)}>{item.node.name}</span>
                  </Td>
                  <Td className="font-mono text-sg-muted">{item.rng.id}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {rooms.length === 0 && (
            <p className="px-4 py-6 text-xs text-sg-muted">
              Inga rum. Skapa dem i{" "}
              <Link href="/admin/structure" className="text-sg-lime underline-offset-2 hover:underline">
                Studio › Struktur
              </Link>
              .
            </p>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Tjänster" meta="30 dagars historik">
          <ul className="divide-y divide-sg-line">
            {SERVICES.map((service) => {
              const roomsOnNode = service.group === "Render" ? rooms.filter((item) => item.node.id === service.id).length : null
              return (
                <li key={service.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {service.name}
                      <span className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">{service.group}</span>
                    </p>
                    <p className="truncate text-[11px] text-sg-muted">
                      {roomsOnNode !== null ? `${service.note} · ${roomsOnNode} rum` : service.note}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={service.status} />
                    <p className="font-mono text-[10px] text-sg-muted">{`${service.latencyMs} ms · ${service.uptime.toFixed(2).replace(".", ",")} %`}</p>
                  </div>
                  <UptimeBar serviceId={service.id} status={service.status} />
                </li>
              )
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Slumpgeneratorer" meta="Självtest var 60:e sekund">
            <ul className="divide-y divide-sg-line">
              {RNGS.map((rng) => {
                const games = studio.games.filter((game) => rngForGame(game.kind).id === rng.id)
                const certSoon = rng.certUntil < CERT_WARNING_BEFORE
                return (
                  <li key={rng.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{rng.name}</p>
                      <StatusBadge status={rng.status} />
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-sg-muted">
                      <span className={cn("inline-flex items-center gap-1", certSoon && "text-sg-amber")}>
                        <ShieldCheck className="size-3" aria-hidden />
                        {`${rng.cert} t.o.m. ${rng.certUntil}${certSoon ? " · förnya" : ""}`}
                      </span>
                      <span className="font-mono">{`självtest ${rng.lastSelfTest}`}</span>
                    </p>
                    <p className="text-[11px] text-sg-muted">
                      {games.length
                        ? `Används av: ${games
                            .map((game) => `${game.name} (${studio.operators.find((item) => item.id === game.operatorId)?.name})`)
                            .join(", ")}`
                        : "Inga spel kopplade"}
                    </p>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel title="Incidenter" meta="Senaste 7 dagar">
            <ol className="divide-y divide-sg-line">
              {INCIDENTS.map((incident) => (
                <li key={incident.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={incident.status} label={incident.title} />
                  </div>
                  <p className="text-[11px] text-sg-muted">{`${formatAt(incident.at)} · ${incident.body}`}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </Page>
  )
}

function UptimeBar({ serviceId, status }: { serviceId: string; status: ServiceStatus }) {
  const ticks = uptimeTicks(serviceId, status)
  return (
    <div className="col-span-2 flex h-5 items-stretch gap-px sm:col-span-1" role="img" aria-label="Status senaste 30 dagarna">
      {ticks.map((tick, index) => (
        <span key={index} className={cn("flex-1 rounded-[1px]", STATUS_META[tick].dot, tick === "up" && "opacity-60")} />
      ))}
    </div>
  )
}
