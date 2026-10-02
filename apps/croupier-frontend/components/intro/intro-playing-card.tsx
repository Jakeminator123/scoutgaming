"use client"

import { useEffect, useLayoutEffect, useRef } from "react"

export type Box = { left: number; top: number; width: number; height: number }

const DURATION_MS = 2300
/** The paper face turns into the hero card's ink end card during the last part of the growth. */
const INK_DELAY_MS = 1900
const INK_MS = 450
const SETTLE_MS = 250

function box(cx: number, cy: number, width: number, height: number) {
  return { left: `${cx - width / 2}px`, top: `${cy - height / 2}px`, width: `${width}px`, height: `${height}px` }
}

/**
 * A Scout Gaming playing card spins in, stops over Astrid's face and grows until it has exactly
 * the hero card's size and position, turning into the same ink end card the hero card shows.
 */
export function IntroPlayingCard({ face, target, onDone }: { face: { x: number; y: number }; target: Box; onDone: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  // Runs once: the flight is planned from where she sat when the card was dealt.
  useLayoutEffect(() => {
    const card = cardRef.current
    const ink = inkRef.current
    if (!card || !ink) return
    const w0 = Math.max(84, target.width * 0.3)
    const h0 = w0 * 1.4
    const end = {
      left: `${target.left}px`,
      top: `${target.top}px`,
      width: `${target.width}px`,
      height: `${target.height}px`,
    }
    const flight = card.animate(
      [
        {
          ...box(-w0, face.y - window.innerHeight * 0.32, w0, h0),
          transform: "rotate(-620deg)",
          borderRadius: "10px",
          offset: 0,
          easing: "cubic-bezier(0.12, 0.62, 0.25, 1)",
        },
        { ...box(face.x + w0 * 0.07, face.y + 4, w0, h0), transform: "rotate(5deg)", borderRadius: "10px", offset: 0.4, easing: "ease-out" },
        { ...box(face.x, face.y, w0, h0), transform: "rotate(0deg)", borderRadius: "10px", offset: 0.5 },
        {
          ...box(face.x, face.y, w0, h0),
          transform: "rotate(0deg)",
          borderRadius: "10px",
          offset: 0.6,
          easing: "cubic-bezier(0.7, 0, 0.2, 1)",
        },
        { ...end, transform: "rotate(0deg)", borderRadius: "32px", offset: 1 },
      ],
      { duration: DURATION_MS, fill: "forwards" },
    )
    const turn = ink.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: INK_MS,
      delay: INK_DELAY_MS,
      fill: "forwards",
      easing: "ease-in-out",
    })
    let settle: ReturnType<typeof setTimeout> | undefined
    Promise.all([flight.finished, turn.finished])
      .then(() => {
        settle = setTimeout(() => doneRef.current(), SETTLE_MS)
      })
      .catch(() => {})
    return () => {
      clearTimeout(settle)
      flight.cancel()
      turn.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={cardRef} className="intro-card @container" aria-hidden="true">
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-off text-ink">
        <span className="absolute top-[5cqw] left-[6cqw] flex flex-col items-center font-mono text-[9cqw] leading-none font-bold">
          S<span className="text-[#6f8f00]">/</span>G
        </span>
        <p className="text-[12cqw] leading-none font-semibold tracking-tight">
          scout<span className="text-[#6f8f00]">/</span>gaming
        </p>
        <span className="absolute right-[6cqw] bottom-[5cqw] flex rotate-180 flex-col items-center font-mono text-[9cqw] leading-none font-bold">
          S<span className="text-[#6f8f00]">/</span>G
        </span>
        <span className="absolute inset-[3cqw] rounded-[inherit] border border-ink/15" />
      </div>
      <div ref={inkRef} className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink opacity-0">
        <p className="text-[10.9cqw] font-semibold tracking-tight text-off">
          scout<span className="text-lime">/</span>gaming
        </p>
        <p className="font-mono text-[10px] tracking-[0.25em] text-off/50 uppercase">Blackjackpilot</p>
      </div>
    </div>
  )
}
