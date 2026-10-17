"use client"

import { type CSSProperties, useEffect, useRef } from "react"
import { Chip, DecoCard, DecoCardBack, Football, PitchCard, QueenCard } from "./deco"
import { useFantasyMode } from "./fantasy-mode"
import { parallaxStyle } from "./parallax-style"
import type { Suit } from "@/lib/blackjack"

type Item =
  | { kind: "card"; rank: string; suit: Suit }
  | { kind: "back" }
  | { kind: "queen"; suit: "spades" | "hearts" }
  | { kind: "chip"; value: 10 | 25 | 100 | 500 }

interface StreamItem {
  item: Item
  top: string
  size: string
  dur: number
  delay: number
  r0: number
  r1: number
  depth: "far" | "mid" | "near"
}

const STREAM: StreamItem[] = [
  { item: { kind: "card", rank: "A", suit: "spades" }, top: "5%", size: "w-24 md:w-32", dur: 22, delay: -2, r0: -40, r1: 30, depth: "near" },
  { item: { kind: "chip", value: 100 }, top: "12%", size: "w-12 md:w-16", dur: 17, delay: -9, r0: 0, r1: 720, depth: "mid" },
  { item: { kind: "card", rank: "K", suit: "hearts" }, top: "20%", size: "w-16 md:w-24", dur: 26, delay: -14, r0: -20, r1: 50, depth: "far" },
  { item: { kind: "queen", suit: "spades" }, top: "26%", size: "w-28 md:w-40", dur: 30, delay: -20, r0: -14, r1: 10, depth: "near" },
  { item: { kind: "chip", value: 25 }, top: "36%", size: "w-10 md:w-14", dur: 15, delay: -11, r0: 0, r1: -540, depth: "far" },
  { item: { kind: "queen", suit: "hearts" }, top: "44%", size: "w-24 md:w-36", dur: 27, delay: -75, r0: -20, r1: 24, depth: "near" },
  { item: { kind: "card", rank: "10", suit: "clubs" }, top: "52%", size: "w-14 md:w-20", dur: 28, delay: -8, r0: -10, r1: 60, depth: "far" },
  { item: { kind: "chip", value: 500 }, top: "60%", size: "w-14 md:w-20", dur: 19, delay: -3, r0: 0, r1: 900, depth: "near" },
  { item: { kind: "card", rank: "J", suit: "spades" }, top: "68%", size: "w-20 md:w-28", dur: 21, delay: -19, r0: -50, r1: 25, depth: "mid" },
  { item: { kind: "back" }, top: "76%", size: "w-16 md:w-24", dur: 25, delay: -12, r0: -25, r1: 55, depth: "far" },
  { item: { kind: "chip", value: 10 }, top: "84%", size: "w-10 md:w-12", dur: 16, delay: -6, r0: 0, r1: 600, depth: "mid" },
  { item: { kind: "card", rank: "9", suit: "hearts" }, top: "90%", size: "w-24 md:w-32", dur: 23, delay: -1, r0: -35, r1: 35, depth: "near" },
]

const DEPTH_CLASS = {
  far: "opacity-30 blur-[3px]",
  mid: "opacity-55 blur-[1px]",
  near: "opacity-85",
}

const DEPTH_PARALLAX = { far: 3, mid: 8, near: 16 }

const REPEL_DISTANCE = 96
const FLIP_DEGREES = 180
const SPIN_DEGREES = 140

const MORPH = "transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]"

function Morph({ casino, fantasy, on }: { casino: React.ReactNode; fantasy: React.ReactNode; on: boolean }) {
  return (
    <div className="relative">
      <div className={`${MORPH} ${on ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}>
        {casino}
      </div>
      <div
        className={`absolute inset-0 ${MORPH} ${on ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0"}`}
      >
        {fantasy}
      </div>
    </div>
  )
}

function CardFront({ item }: { item: Item }) {
  if (item.kind === "card") return <DecoCard rank={item.rank} suit={item.suit} />
  if (item.kind === "queen") return <QueenCard suit={item.suit} />
  return <DecoCardBack />
}

function CardBack({ item }: { item: Item }) {
  if (item.kind === "back") return <DecoCard rank="A" suit="spades" />
  return <DecoCardBack />
}

function Piece({ item, fantasy }: { item: Item; fantasy: boolean }) {
  if (item.kind === "chip") {
    return <Morph on={fantasy} casino={<Chip value={item.value} />} fantasy={<Football />} />
  }

  return (
    <div className="relative [transform-style:preserve-3d]">
      <div className="[backface-visibility:hidden]">
        <Morph on={fantasy} casino={<CardFront item={item} />} fantasy={<PitchCard />} />
      </div>
      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
        <Morph on={fantasy} casino={<CardBack item={item} />} fantasy={<PitchCard />} />
      </div>
    </div>
  )
}

export function CardStream() {
  const { fantasy } = useFantasyMode()
  const trackRefs = useRef<(HTMLDivElement | null)[]>([])
  const pieceRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const pointer = { x: -9999, y: -9999 }
    const state = STREAM.map(() => ({ x: 0, y: 0, rot: 0 }))

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
    }
    const onLeave = () => {
      pointer.x = -9999
      pointer.y = -9999
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    document.documentElement.addEventListener("pointerleave", onLeave)

    let raf = 0
    const tick = () => {
      for (let i = 0; i < STREAM.length; i++) {
        const track = trackRefs.current[i]
        const piece = pieceRefs.current[i]
        if (!track || !piece) continue

        const rect = track.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = cx - pointer.x
        const dy = cy - pointer.y
        const dist = Math.hypot(dx, dy) || 1
        const radius = Math.max(rect.width, rect.height) * 0.9 + 110

        let targetX = 0
        let targetY = 0
        let targetRot = 0
        if (dist < radius) {
          const k = 1 - dist / radius
          const ease = k * k
          targetX = (dx / dist) * ease * REPEL_DISTANCE
          targetY = (dy / dist) * ease * REPEL_DISTANCE
          targetRot = ease * (STREAM[i].item.kind === "chip" ? SPIN_DEGREES : FLIP_DEGREES)
        }

        const s = state[i]
        s.x += (targetX - s.x) * 0.22
        s.y += (targetY - s.y) * 0.22
        s.rot += (targetRot - s.rot) * 0.16

        const spin = STREAM[i].item.kind === "chip" ? `rotate(${s.rot}deg)` : `rotateY(${s.rot}deg)`
        piece.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) ${spin}`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onMove)
      document.documentElement.removeEventListener("pointerleave", onLeave)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden [perspective:900px]">
      {STREAM.map((s, i) => (
        <div
          key={i}
          className={`absolute left-0 ${s.size} ${DEPTH_CLASS[s.depth]} will-change-transform`}
          style={{ top: s.top, ...parallaxStyle(DEPTH_PARALLAX[s.depth], true) }}
        >
          <div
            ref={(el) => {
              trackRefs.current[i] = el
            }}
            className={s.item.kind === "queen" ? "animate-stream-rare" : "animate-stream"}
            style={
              {
                "--dur": `${s.dur}s`,
                "--delay": `${s.delay}s`,
                "--r0": `${s.r0}deg`,
                "--r1": `${s.r1}deg`,
              } as CSSProperties
            }
          >
            <div
              ref={(el) => {
                pieceRefs.current[i] = el
              }}
              className="will-change-transform [transform-style:preserve-3d]"
            >
              <Piece item={s.item} fantasy={fantasy} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
