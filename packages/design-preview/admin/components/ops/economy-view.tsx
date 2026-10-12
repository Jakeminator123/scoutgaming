"use client"

import { useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { AlertTriangle, Plus, X } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { DAY_LABELS, computeEconomy, formatCompactSek, formatSek, type TermScope } from "@/lib/ops"
import { DEALER_KINDS, type DealerKind } from "@/lib/studio-assets"
import { useStudio } from "@/components/studio/studio-provider"
import { Kpis, Page, PageHeader, Panel, PercentEditor, SmallButton, Td, Th, inputClass } from "./ui"
import { cn } from "@/lib/utils"

const SERIES_COLORS = ["#d6ff3a", "#3ad6c4", "#ffb547", "#ff5c6c", "#8b9098"]
const SOURCE_LABEL = { operator: "grundavtal", game: "spelavtal", dealer: "dealeravtal" }

export function EconomyView() {
  const studio = useStudio()
  const [filter, setFilter] = useState<string>("all")
  const canEdit = studio.accessLevel === 1

  const rows = useMemo(
    () => computeEconomy({ ...studio }, studio.terms),
    [studio],
  )
  const visible = filter === "all" ? rows : rows.filter((row) => row.operatorId === filter)
  const visibleOperators = studio.operators.filter((item) => filter === "all" || item.id === filter)

  const total = (key: "ggr" | "take" | "payout" | "net") => visible.reduce((sum, row) => sum + row[key], 0)

  const chartConfig = Object.fromEntries(
    visibleOperators.map((operator, index) => [
      operator.id,
      { label: operator.name, color: SERIES_COLORS[index % SERIES_COLORS.length] },
    ]),
  ) satisfies ChartConfig

  const chartData = DAY_LABELS.map((day, index) => {
    const point: Record<string, string | number> = { day }
    for (const operator of visibleOperators) {
      point[operator.id] = Math.round(
        visible.filter((row) => row.operatorId === operator.id).reduce((sum, row) => sum + row.daily[index], 0),
      )
    }
    return point
  })

  return (
    <Page>
      <PageHeader
        eyebrow="Ekonomi · Senaste 30 dagar"
        title="Intäkter & avtal"
        description="Vi tar en andel av spelbolagens GGR. Andelen kan sättas per bolag, per spel eller per dealer, det mest specifika gäller. Kändisdealers får revshare som betalas ur vår andel. Alla ändringar protokollförs."
        aside={
          <div className="flex items-center gap-2">
            <label htmlFor="economy-filter" className="font-mono text-[10px] uppercase tracking-wider text-sg-muted">
              Spelbolag
            </label>
            <select id="economy-filter" value={filter} onChange={(event) => setFilter(event.target.value)} className={inputClass}>
              <option value="all">Alla</option>
              {studio.operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <Kpis
        items={[
          { label: "Spelbolagens GGR", value: formatCompactSek(total("ggr")), hint: "Bruttospelintäkt i våra rum" },
          {
            label: "Vår andel",
            value: formatCompactSek(total("take")),
            hint: total("ggr") ? `${((total("take") / total("ggr")) * 100).toFixed(1).replace(".", ",")} % effektivt` : "–",
          },
          { label: "Kändis-revshare", value: formatCompactSek(total("payout")), hint: "Betalas ur vår andel", tone: "amber" },
          { label: "Netto", value: formatCompactSek(total("net")), hint: "Andel minus revshare", tone: "lime" },
        ]}
      />

      <Panel title="Netto per dag" meta="Per spelbolag, staplat">
        {visibleOperators.length === 0 ? (
          <p className="px-4 py-6 text-xs text-sg-muted">Inga spelbolag.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full px-2 pb-2 pt-4">
            <AreaChart data={chartData} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} stroke="#33363b" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tick={{ fill: "#8b9098", fontSize: 10 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fill: "#8b9098", fontSize: 10 }}
                tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => `${chartConfig[name as string]?.label ?? name}: ${formatSek(Number(value))}`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              {visibleOperators.map((operator) => (
                <Area
                  key={operator.id}
                  dataKey={operator.id}
                  type="monotone"
                  stackId="net"
                  stroke={`var(--color-${operator.id})`}
                  fill={`var(--color-${operator.id})`}
                  fillOpacity={0.18}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </Panel>

      <Panel
        title="Avtal per spelbolag"
        meta={canEdit ? "Ändringar kräver anledning" : "Läsläge · nivå 1 krävs för ändringar"}
        action={
          <Link href="/control/admin/log" className="text-xs text-sg-muted hover:text-sg-lime">
            Protokoll →
          </Link>
        }
      >
        <ul className="divide-y divide-sg-line">
          {visibleOperators.map((operator) => {
            const operatorRows = rows.filter((row) => row.operatorId === operator.id)
            const ggr = operatorRows.reduce((sum, row) => sum + row.ggr, 0)
            const take = operatorRows.reduce((sum, row) => sum + row.take, 0)
            const overrides = studio.terms.filter((term) => term.operatorId === operator.id)
            return (
              <li key={operator.id} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-medium">
                    {operator.name}
                    {operator.status === "paused" && (
                      <span className="rounded bg-sg-amber/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-sg-amber">Pausad</span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="text-sg-muted">Grundandel</span>
                      <PercentEditor
                        label={`grundandel ${operator.name}`}
                        value={operator.sharePct}
                        disabled={!canEdit}
                        onSave={(pct, reason) => studio.setOperatorShare(operator.id, pct, reason)}
                      />
                    </span>
                    <span>
                      <span className="text-sg-muted">GGR </span>
                      <span className="font-mono tabular-nums">{formatSek(ggr)}</span>
                    </span>
                    <span>
                      <span className="text-sg-muted">Vår andel </span>
                      <span className="font-mono tabular-nums text-sg-lime">{formatSek(take)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 rounded-md border border-sg-line bg-sg-bg p-2">
                  <p className="px-1 font-mono text-[10px] uppercase tracking-wider text-sg-muted">Undantag från grundandel</p>
                  {overrides.length === 0 && <p className="px-1 text-xs text-sg-muted">Inga undantag, allt följer grundandelen.</p>}
                  {overrides.map((term) => {
                    const target =
                      term.scope === "game"
                        ? studio.games.find((game) => game.id === term.targetId)?.name
                        : studio.dealers.find((item) => item.id === term.targetId)?.name
                    return (
                      <div key={term.id} className="flex flex-wrap items-center justify-between gap-2 rounded px-1 py-1 text-xs hover:bg-sg-panel">
                        <span>
                          <span className="mr-2 font-mono text-[10px] uppercase text-sg-muted">{term.scope === "game" ? "Spel" : "Dealer"}</span>
                          {target}
                        </span>
                        <span className="flex items-center gap-1">
                          <PercentEditor
                            label={`andel ${target}`}
                            value={term.pct}
                            disabled={!canEdit}
                            onSave={(pct, reason) => studio.upsertTerm(operator.id, term.scope, term.targetId, pct, reason)}
                          />
                          {canEdit && (
                            <button
                              type="button"
                              aria-label={`Ta bort undantag för ${target}`}
                              title="Ta bort undantag"
                              onClick={() => {
                                const reason = window.prompt(`Anledning till att ${target} går tillbaka till grundandelen:`)
                                if (reason?.trim()) studio.removeTerm(term.id, reason.trim())
                              }}
                              className="rounded p-1 text-sg-muted hover:text-sg-red"
                            >
                              <X className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </span>
                      </div>
                    )
                  })}
                  {canEdit && <AddTermForm operatorId={operator.id} />}
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title="Dealers & revshare" meta={`${visible.length} dealers`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Dealer</Th>
                <Th>Typ</Th>
                <Th>Revshare</Th>
                <Th>Vår andel</Th>
                <Th className="text-right">GGR</Th>
                <Th className="text-right">Utbetalning</Th>
                <Th className="text-right">Netto</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {visible.map((row) => {
                const negative = row.dealer.revsharePct >= row.pct && row.dealer.revsharePct > 0
                const operatorName = studio.operators.find((item) => item.id === row.operatorId)?.name
                return (
                  <tr key={row.dealer.id}>
                    <Td>
                      <span className="font-medium">{row.dealer.name}</span>
                      <span className="block text-[11px] text-sg-muted">{`${operatorName} · ${row.game.name} · ${row.room.name}`}</span>
                    </Td>
                    <Td>
                      <label className="sr-only" htmlFor={`kind-${row.dealer.id}`}>{`Typ för ${row.dealer.name}`}</label>
                      <select
                        id={`kind-${row.dealer.id}`}
                        value={row.dealer.kind}
                        disabled={!canEdit}
                        onChange={(event) => studio.setDealerKind(row.dealer.id, event.target.value as DealerKind)}
                        className={cn(inputClass, "disabled:opacity-70")}
                        title={DEALER_KINDS[row.dealer.kind].hint}
                      >
                        {Object.entries(DEALER_KINDS).map(([kind, meta]) => (
                          <option key={kind} value={kind}>
                            {meta.label}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      {row.dealer.kind === "celebrity" ? (
                        <PercentEditor
                          label={`revshare ${row.dealer.name}`}
                          value={row.dealer.revsharePct}
                          max={30}
                          disabled={!canEdit}
                          onSave={(pct, reason) => studio.setDealerRevshare(row.dealer.id, pct, reason)}
                          suffix={
                            negative ? (
                              <AlertTriangle className="size-3.5 text-sg-red" aria-label="Revshare är högre än vår andel" />
                            ) : null
                          }
                        />
                      ) : (
                        <span className="text-sg-muted">–</span>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono tabular-nums">{`${row.pct} %`}</span>
                      <span className="ml-1.5 text-[10px] text-sg-muted">{SOURCE_LABEL[row.source]}</span>
                    </Td>
                    <Td className="text-right font-mono tabular-nums">{formatSek(row.ggr)}</Td>
                    <Td className="text-right font-mono tabular-nums text-sg-amber">{row.payout ? formatSek(row.payout) : "–"}</Td>
                    <Td className={cn("text-right font-mono tabular-nums", row.net < 0 ? "text-sg-red" : "text-sg-lime")}>
                      {formatSek(row.net)}
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

function AddTermForm({ operatorId }: { operatorId: string }) {
  const studio = useStudio()
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState("")
  const [pct, setPct] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  const games = studio.games.filter((game) => game.operatorId === operatorId)
  const gameIds = new Set(games.map((game) => game.id))
  const roomIds = new Set(studio.rooms.filter((room) => gameIds.has(room.gameId)).map((room) => room.id))
  const dealers = studio.dealers.filter((item) => roomIds.has(item.roomId))
  const taken = new Set(studio.terms.map((term) => term.targetId))

  const close = () => {
    setOpen(false)
    setTarget("")
    setPct("")
    setReason("")
    setError(null)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const [scope, id] = target.split(":") as [TermScope, string]
    const parsed = Number(pct.replace(",", "."))
    if (!id) return setError("Välj spel eller dealer")
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50) return setError("Andel 0–50 %")
    if (!reason.trim()) return setError("Ange anledning för protokollet")
    studio.upsertTerm(operatorId, scope, id, Math.round(parsed * 10) / 10, reason.trim())
    close()
  }

  if (!open) {
    return (
      <SmallButton onClick={() => setOpen(true)} className="self-start border-dashed">
        <Plus className="size-3" aria-hidden />
        Undantag för spel eller dealer
      </SmallButton>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
      <label className="sr-only" htmlFor={`term-target-${operatorId}`}>Gäller</label>
      <select id={`term-target-${operatorId}`} value={target} onChange={(event) => setTarget(event.target.value)} className={inputClass} autoFocus>
        <option value="">Välj…</option>
        <optgroup label="Spel">
          {games.map((game) => (
            <option key={game.id} value={`game:${game.id}`} disabled={taken.has(game.id)}>
              {game.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Dealer">
          {dealers.map((item) => (
            <option key={item.id} value={`dealer:${item.id}`} disabled={taken.has(item.id)}>
              {`${item.name} (${DEALER_KINDS[item.kind].label})`}
            </option>
          ))}
        </optgroup>
      </select>
      <label className="sr-only" htmlFor={`term-pct-${operatorId}`}>Andel i procent</label>
      <input id={`term-pct-${operatorId}`} inputMode="decimal" value={pct} onChange={(event) => setPct(event.target.value)} placeholder="%" className={cn(inputClass, "w-14 font-mono")} />
      <label className="sr-only" htmlFor={`term-reason-${operatorId}`}>Anledning</label>
      <input id={`term-reason-${operatorId}`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Anledning (protokoll)" className={cn(inputClass, "w-48")} />
      <SmallButton type="submit" tone="primary">
        Spara
      </SmallButton>
      <SmallButton onClick={close}>Avbryt</SmallButton>
      {error && (
        <span role="alert" className="text-[11px] text-sg-amber">
          {error}
        </span>
      )}
    </form>
  )
}
