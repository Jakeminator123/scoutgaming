"use client"

import Link from "next/link"
import { ArrowRight, Building2, DoorOpen, Gamepad2, UserRound } from "lucide-react"
import { IDLE_CLIPS } from "@/lib/studio-assets"
import { useStudio } from "./studio-provider"
import { cn } from "@/lib/utils"

export function StructureView() {
  const studio = useStudio()
  const { operators, games, rooms, dealers, assets } = studio
  const assetName = (id: string | null) => assets.find((item) => item.id === id)?.name ?? "Ingen"
  const idleName = (id: string) => IDLE_CLIPS.find((clip) => clip.id === id)?.name ?? id

  const counts = [
    { label: "Spelbolag", value: operators.length },
    { label: "Spel", value: games.length },
    { label: "Rum", value: rooms.length },
    { label: "Dealers", value: dealers.length },
  ]

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-sg-lime">{"// Studio · Struktur"}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Spelbolag → Spel → Rum → Dealer</h1>
          <p className="mt-1 max-w-2xl text-sm text-sg-muted">
            Hela uppsättningen på ett ställe. Välj en dealer för att öppna dess klippkarta. Lägg till och ta bort på
            valfri nivå i raden ovanför. Exempeldata, inget sparas.
          </p>
        </div>
        <dl className="flex gap-2">
          {counts.map((item) => (
            <div key={item.label} className="min-w-20 rounded-md border border-sg-line bg-sg-panel px-3 py-2">
              <dt className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">{item.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {operators.length === 0 && <EmptyNote text="Inga spelbolag. Lägg till ett i raden ovanför." />}

      <ul className="flex flex-col gap-4">
        {operators.map((operator) => {
          const operatorGames = games.filter((game) => game.operatorId === operator.id)
          const isActiveOperator = studio.activeOperator?.id === operator.id
          return (
            <li key={operator.id} className={cn("rounded-lg border bg-sg-panel", isActiveOperator ? "border-sg-lime/50" : "border-sg-line")}>
              <button
                type="button"
                onClick={() => studio.select("operator", operator.id)}
                className="flex w-full items-center gap-2 border-b border-sg-line px-4 py-3 text-left"
              >
                <Building2 className="size-4 text-sg-lime" aria-hidden />
                <span className="font-semibold">{operator.name}</span>
                <span className="font-mono text-[10px] text-sg-muted">{`${operatorGames.length} spel`}</span>
              </button>

              <ul className="flex flex-col gap-3 p-4">
                {operatorGames.length === 0 && <EmptyNote text="Inga spel ännu." />}
                {operatorGames.map((game) => {
                  const gameRooms = rooms.filter((room) => room.gameId === game.id)
                  return (
                    <li key={game.id} className="flex flex-col gap-2">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Gamepad2 className="size-4 text-sg-teal" aria-hidden />
                        {game.name}
                      </p>
                      <ul className="grid gap-3 pl-6 sm:grid-cols-2 xl:grid-cols-3">
                        {gameRooms.length === 0 && <EmptyNote text="Inga rum ännu." />}
                        {gameRooms.map((room) => {
                          const roomDealers = dealers.filter((item) => item.roomId === room.id)
                          return (
                            <li key={room.id} className="flex flex-col rounded-md border border-sg-line bg-sg-bg">
                              <p className="flex items-center justify-between gap-2 border-b border-sg-line px-3 py-2 text-xs">
                                <span className="flex items-center gap-2 font-medium">
                                  <DoorOpen className="size-3.5 text-sg-amber" aria-hidden />
                                  {room.name}
                                </span>
                                <span className="font-mono text-[10px] text-sg-muted">{`${room.seats} platser`}</span>
                              </p>
                              <ul className="flex flex-col p-1.5">
                                {roomDealers.length === 0 && (
                                  <li className="px-2 py-2 text-[11px] text-sg-muted">Ingen dealer i rummet.</li>
                                )}
                                {roomDealers.map((item) => {
                                  const isActive = studio.activeDealer?.id === item.id
                                  return (
                                    <li key={item.id}>
                                      <Link
                                        href="/control/clips"
                                        onClick={() => studio.selectDealerPath(item.id)}
                                        className={cn(
                                          "group flex items-center gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-sg-panel",
                                          isActive && "bg-sg-panel",
                                        )}
                                      >
                                        <UserRound className={cn("size-3.5", isActive ? "text-sg-lime" : "text-sg-muted")} aria-hidden />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                          <span className="text-xs font-medium">{item.name}</span>
                                          <span className="truncate font-mono text-[10px] text-sg-muted">
                                            {`${assetName(item.tableId)} · ${assetName(item.backgroundId)} · ${idleName(item.idleClipId)}`}
                                          </span>
                                        </span>
                                        <ArrowRight
                                          className="size-3.5 text-sg-muted opacity-0 transition-opacity group-hover:opacity-100"
                                          aria-hidden
                                        />
                                        <span className="sr-only">Öppna klippkarta</span>
                                      </Link>
                                    </li>
                                  )
                                })}
                              </ul>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <li className="list-none rounded-md border border-dashed border-sg-line px-3 py-3 text-xs text-sg-muted">{text}</li>
}
