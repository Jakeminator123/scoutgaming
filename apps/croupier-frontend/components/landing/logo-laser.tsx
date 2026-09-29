"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef } from "react"
import { useIntroHandoff } from "@/lib/intro-handoff"

const WORM = 160
const FLIGHT_MS = 1150
/** Lets the intro's playing card finish handing over to the hero card before the laser flies. */
const AFTER_INTRO_MS = 1100
/** When no intro plays, the curtain decides that within a frame or two; wait a little longer than that. */
const NO_INTRO_MS = 700

/**
 * The logo with a lime "laser worm" that shoots up from the hero's lower left and lands in the
 * slash, once when the page is revealed and again whenever the logo is hovered or focused.
 */
export function LogoLaser() {
  const handoff = useIntroHandoff()
  const slashRef = useRef<HTMLSpanElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const glowRef = useRef<SVGPathElement>(null)
  const coreRef = useRef<SVGPathElement>(null)
  const flyingRef = useRef(false)
  const firedOnLoadRef = useRef(false)

  const fire = useCallback(() => {
    const slash = slashRef.current
    const svg = svgRef.current
    const paths = [glowRef.current, coreRef.current]
    if (!slash || !svg || flyingRef.current || paths.some((p) => !p)) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const vw = window.innerWidth
    const vh = window.innerHeight
    const box = slash.getBoundingClientRect()
    const endX = box.left + box.width / 2
    const endY = box.top + box.height / 2
    const startX = vw * 0.04
    const startY = vh * 0.92
    const d = `M${startX} ${startY} C${vw * 0.34} ${vh * 0.78} ${endX + vw * 0.22} ${endY + vh * 0.42} ${endX} ${endY}`

    flyingRef.current = true
    svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`)
    svg.style.opacity = "1"
    const timing: KeyframeAnimationOptions = { duration: FLIGHT_MS, easing: "cubic-bezier(0.55, 0, 0.25, 1)", fill: "forwards" }
    const flights = (paths as SVGPathElement[]).map((path) => {
      path.setAttribute("d", d)
      return path.animate([{ strokeDashoffset: WORM }, { strokeDashoffset: -1000 }], timing)
    })
    flights[0].finished
      .catch(() => undefined)
      .then(() => {
        svg.style.opacity = "0"
        for (const flight of flights) flight.cancel()
        flyingRef.current = false
      })

    slash.animate(
      [
        { transform: "scale(1)", textShadow: "0 0 0 transparent", color: "var(--scout-lime)" },
        { transform: "scale(1.35)", textShadow: "0 0 10px var(--scout-lime), 0 0 26px var(--scout-lime)", color: "#f7ffd6", offset: 0.35 },
        { transform: "scale(1)", textShadow: "0 0 6px var(--scout-lime)", color: "var(--scout-lime)" },
      ],
      { duration: 700, delay: FLIGHT_MS * 0.82, easing: "ease-out" },
    )
  }, [])

  useEffect(() => {
    if (firedOnLoadRef.current || handoff === "holding") return
    const timer = setTimeout(
      () => {
        firedOnLoadRef.current = true
        fire()
      },
      handoff === "revealed" ? AFTER_INTRO_MS : NO_INTRO_MS,
    )
    return () => clearTimeout(timer)
  }, [handoff, fire])

  return (
    <>
      <Link
        href="/"
        className="text-xl font-semibold tracking-tight text-off"
        aria-label="Scout Gaming Group, startsida"
        onPointerEnter={fire}
        onFocus={fire}
      >
        scout
        <span ref={slashRef} className="inline-block text-lime">
          /
        </span>
        gaming
      </Link>
      <svg
        ref={svgRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 h-full w-full opacity-0"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="logo-laser-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        <path
          ref={glowRef}
          pathLength={1000}
          fill="none"
          stroke="var(--scout-lime)"
          strokeOpacity={0.7}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${WORM} 2000`}
          strokeDashoffset={WORM}
          filter="url(#logo-laser-blur)"
        />
        <path
          ref={coreRef}
          pathLength={1000}
          fill="none"
          stroke="#f2ffb0"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeDasharray={`${WORM} 2000`}
          strokeDashoffset={WORM}
        />
      </svg>
    </>
  )
}
