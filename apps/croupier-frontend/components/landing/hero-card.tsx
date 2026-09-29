"use client"

import Link from "next/link"
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { ArrowRight, RotateCcw, Volume2, VolumeX } from "lucide-react"
import { DealerButton, DecoCard } from "./deco"
import { type Face, useFantasyMode } from "./fantasy-mode"
import type { Suit } from "@/lib/blackjack"
import { useIntroHandoff } from "@/lib/intro-handoff"

/** After the intro's card has become this card, its logo lingers before the video shows through. */
const HANDOFF_LOGO_MS = 650
const HANDOFF_ZOOM_MS = 3300

/** How long the Scout Gaming end card may sit before the card turns to the other face. */
const END_CARD_MS = 4000
/** Flight time of a projectile before it strikes; mirrors the 60% keyframe of `impact` (3.4 s). */
const FLIGHT_MS = 2040
const EARLIEST_HIT_MS = 2200
const LATEST_HIT_MS = END_CARD_MS - 300

const OTHER: Record<Face, Face> = { casino: "fantasy", fantasy: "casino" }

/**
 * One way a projectile can arrive and leave. Offsets are from the hero card's centre: it enters
 * from `from`, ricochets out through `via` and fades away at `to`. `spin` is entry angle, angle at
 * the hit and extra spin on the way out; `jolt` is how far (x, y, rotation) the hero card recoils.
 */
type Trajectory = {
  from: [string, string]
  via: [string, string]
  to: [string, string]
  spin: [number, number, number]
  jolt: [string, string, string]
}

const TRAJECTORIES: Trajectory[] = [
  // Along the stream from bottom-left; glances off and skids away to the right.
  {
    from: ["-70vw", "70vh"],
    via: ["26vw", "-8vh"],
    to: ["60vw", "24vh"],
    spin: [-50, 15, 620],
    jolt: ["16px", "-12px", "2.2deg"],
  },
  // Flat in from the left; bounces straight back over its own shoulder.
  {
    from: ["-85vw", "14vh"],
    via: ["-30vw", "-42vh"],
    to: ["-62vw", "-26vh"],
    spin: [-20, 30, -540],
    jolt: ["20px", "-2px", "1.6deg"],
  },
  // Up from below; clipped on the bottom edge and tossed up and to the left.
  {
    from: ["-28vw", "95vh"],
    via: ["-26vw", "-34vh"],
    to: ["-64vw", "-16vh"],
    spin: [-75, 5, -760],
    jolt: ["4px", "-18px", "-1.8deg"],
  },
  // Down from top-left; knocked out of the air and drops away bottom-right.
  {
    from: ["-75vw", "-48vh"],
    via: ["28vw", "26vh"],
    to: ["44vw", "80vh"],
    spin: [40, -12, 560],
    jolt: ["14px", "10px", "2.6deg"],
  },
]

type Projectile = ({ kind: "card"; rank: string; suit: Suit } | { kind: "dealer" }) & { id: number; path: number }

const PROJECTILE_CARDS: { rank: string; suit: Suit }[] = [
  { rank: "A", suit: "spades" },
  { rank: "K", suit: "hearts" },
  { rank: "Q", suit: "clubs" },
  { rank: "J", suit: "diamonds" },
  { rank: "10", suit: "spades" },
]

/** What interrupts the end card: 2/4 a card from the stream, 1/4 the dealer button, 1/4 nothing. */
function rollProjectile(id: number): Projectile | null {
  const roll = Math.random()
  const path = Math.floor(Math.random() * TRAJECTORIES.length)
  if (roll < 0.5) {
    const card = PROJECTILE_CARDS[Math.floor(Math.random() * PROJECTILE_CARDS.length)]
    return { id, path, kind: "card", ...card }
  }
  if (roll < 0.75) return { id, path, kind: "dealer" }
  return null
}

/** CSS variables read by the `impact` keyframes. The puck spins harder; cards also flip over. */
function projectileStyle(projectile: Projectile): CSSProperties {
  const { from, via, to, spin } = TRAJECTORIES[projectile.path]
  const isCard = projectile.kind === "card"
  return {
    "--fx": from[0],
    "--fy": from[1],
    "--vx": via[0],
    "--vy": via[1],
    "--tx": to[0],
    "--ty": to[1],
    "--r0": `${spin[0]}deg`,
    "--r1": `${spin[1]}deg`,
    "--r2": `${isCard ? spin[2] : spin[2] * 2}deg`,
    "--flip": isCard ? "720deg" : "360deg",
  } as CSSProperties
}

/** CSS variables read by the `hero-jolt` keyframes: the card recoils along the hit direction. */
function joltStyle(path: number): CSSProperties {
  const [jx, jy, jr] = TRAJECTORIES[path].jolt
  return { "--jx": jx, "--jy": jy, "--jr": jr } as CSSProperties
}

const FACE =
  "absolute inset-0 overflow-hidden rounded-[2rem] ring-1 ring-off/15 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"

const TILT = {
  transform:
    "translate3d(calc(var(--mx, 0) * 6px), calc(var(--my, 0) * 6px), 0) rotateX(calc(var(--my, 0) * -2.5deg)) rotateY(calc(var(--mx, 0) * 3.5deg))",
}

const SHINE = {
  background:
    "radial-gradient(circle at calc(50% + var(--mx, 0) * 40%) calc(50% + var(--my, 0) * 40%), rgba(255,255,255,0.14), transparent 55%)",
}

const CONTROL =
  "flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-off ring-1 ring-off/20 backdrop-blur-sm transition-all duration-300 hover:bg-ink/90 hover:text-lime focus-visible:ring-2 focus-visible:ring-lime focus-visible:outline-none"

function EndCard({ visible, tagline, snap = false }: { visible: boolean; tagline: string; snap?: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={`absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink ${
        snap ? "" : "transition-opacity duration-1000 ease-out"
      } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <p className="text-4xl font-semibold tracking-tight text-off md:text-5xl">
        scout<span className="text-lime">/</span>gaming
      </p>
      <p className="font-mono text-[10px] tracking-[0.25em] text-off/50 uppercase">{tagline}</p>
    </div>
  )
}

export function HeroCard() {
  const { fantasy, mode, hover, auto, setAuto } = useFantasyMode()
  const active: Face = fantasy ? "fantasy" : "casino"
  const casinoRef = useRef<HTMLVideoElement>(null)
  const fantasyRef = useRef<HTMLVideoElement>(null)
  const projectileId = useRef(0)
  const [muted, setMuted] = useState(true)
  const [ended, setEnded] = useState<Record<Face, boolean>>({ casino: false, fantasy: false })
  const [projectile, setProjectile] = useState<Projectile | null>(null)
  /** Index into TRAJECTORIES while the hero card recoils from a hit, otherwise null. */
  const [jolt, setJolt] = useState<number | null>(null)

  const handoff = useIntroHandoff()
  const holding = handoff === "holding"
  const wasHolding = useRef(false)
  const [introLogo, setIntroLogo] = useState(false)
  const [introZoom, setIntroZoom] = useState(false)

  const videoFor = (face: Face) => (face === "casino" ? casinoRef.current : fantasyRef.current)

  // While the intro plays the card is invisible and waits at its first frame; when the intro's
  // playing card lands on it, it takes over showing the same logo, then opens on Astrid's face.
  useEffect(() => {
    if (holding) {
      wasHolding.current = true
      const video = casinoRef.current
      if (video) {
        video.pause()
        video.currentTime = 0
      }
      return
    }
    if (handoff !== "revealed" || !wasHolding.current) return
    wasHolding.current = false
    setIntroLogo(true)
    setIntroZoom(true)
    const logo = setTimeout(() => setIntroLogo(false), HANDOFF_LOGO_MS)
    const zoom = setTimeout(() => setIntroZoom(false), HANDOFF_ZOOM_MS)
    return () => {
      clearTimeout(logo)
      clearTimeout(zoom)
    }
  }, [handoff, holding])

  // Only the face turned toward the viewer plays, so audio never overlaps across the flip.
  useEffect(() => {
    videoFor(active === "casino" ? "fantasy" : "casino")?.pause()
    if (holding) return
    if (!ended[active]) videoFor(active)?.play().catch(() => {})
  }, [active, ended, holding])

  // Unattended end card: within END_CARD_MS something turns the card to the face that has not
  // just played — the stream sends a card or the dealer button, or it simply turns by itself.
  // A hovered nav item pauses the cycle entirely; hover always decides what the page shows.
  const autoEnded = ended[auto]
  useEffect(() => {
    if (hover !== null || !autoEnded) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const incoming = reduceMotion ? null : rollProjectile(++projectileId.current)
    const timers: ReturnType<typeof setTimeout>[] = []

    const turn = () => {
      const face = OTHER[auto]
      const video = face === "casino" ? casinoRef.current : fantasyRef.current
      if (video) video.currentTime = 0
      setEnded((prev) => ({ ...prev, [face]: false }))
      setAuto(face)
    }

    if (incoming) {
      const hitAt = EARLIEST_HIT_MS + Math.random() * (LATEST_HIT_MS - EARLIEST_HIT_MS)
      timers.push(setTimeout(() => setProjectile(incoming), hitAt - FLIGHT_MS))
      timers.push(
        setTimeout(() => {
          setJolt(incoming.path)
          turn()
        }, hitAt),
      )
    } else {
      timers.push(setTimeout(turn, END_CARD_MS))
    }

    return () => timers.forEach(clearTimeout)
  }, [hover, auto, autoEnded, setAuto])

  useEffect(() => {
    if (jolt === null) return
    const timer = setTimeout(() => setJolt(null), 700)
    return () => clearTimeout(timer)
  }, [jolt])

  const toggleSound = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    for (const face of ["casino", "fantasy"] as Face[]) {
      const video = videoFor(face)
      if (video) video.muted = nextMuted
    }
    if (!nextMuted && !ended[active]) videoFor(active)?.play().catch(() => {})
  }

  const replay = () => {
    const video = videoFor(active)
    if (!video) return
    video.currentTime = 0
    setEnded((prev) => ({ ...prev, [active]: false }))
    video.play().catch(() => {})
  }

  const markEnded = (face: Face) => () => setEnded((prev) => ({ ...prev, [face]: true }))

  return (
    <div
      className={`relative shrink-0 [perspective:1600px] ${holding ? "pointer-events-none opacity-0" : ""}`}
      aria-hidden={holding || undefined}
    >
      <div aria-hidden="true" className="hero-glow absolute -inset-16 rounded-full" />
      <div className="relative [transform-style:preserve-3d] will-change-transform" style={TILT}>
        <div
          className={`relative transition-transform duration-500 hover:scale-[1.03] [transform-style:preserve-3d] ${
            jolt !== null ? "animate-hero-jolt" : ""
          }`}
          style={jolt !== null ? joltStyle(jolt) : undefined}
        >
          <Link
            href={fantasy ? "https://scoutgaminggroup.com/" : "/demo"}
            aria-label={fantasy ? "Besök Scout Gaming Group" : "Öppna blackjackpiloten med Astrid"}
            className="block [transform-style:preserve-3d]"
          >
            <div
              data-intro-target
              className={`relative h-[520px] w-[330px] transition-transform duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] [transform-style:preserve-3d] md:h-[720px] md:w-[440px] ${
                fantasy ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
              }`}
            >
              <div className={FACE}>
                <video
                  ref={casinoRef}
                  src="/videos/astrid-card.mp4"
                  poster="/images/astrid-card-poster.jpg"
                  muted
                  playsInline
                  preload="auto"
                  onEnded={markEnded("casino")}
                  aria-label="Astrid, blond croupier i svart kavaj, hälsar välkommen vid blackjackbordet"
                  className={`absolute inset-0 h-full w-full object-cover ${introZoom ? "animate-intro-face-zoom" : ""}`}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink to-transparent"
                />
                <div className="absolute inset-x-0 top-0 flex justify-end p-6">
                  <span
                    className={`flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.2em] text-off uppercase backdrop-blur-sm transition-opacity duration-500 ${
                      mode === "live" ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    Live nu
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.25em] text-lime uppercase">{"// Croupier"}</p>
                    <p className="font-serif text-3xl text-off">Astrid</p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider text-ink uppercase">
                    Spela <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
                <EndCard visible={ended.casino || introLogo} snap={introLogo} tagline="Blackjackpilot" />
                <div aria-hidden="true" className="absolute inset-0 mix-blend-soft-light" style={SHINE} />
              </div>

              <div className={`${FACE} [transform:rotateY(180deg)]`}>
                <video
                  ref={fantasyRef}
                  src="/videos/fantasy-card.mp4"
                  poster="/images/fantasy-card-poster.jpg"
                  muted
                  playsInline
                  preload="metadata"
                  onEnded={markEnded("fantasy")}
                  aria-label="Scout Fantasy: fans på arenan, spelare i realtid och odds i mobilen"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink via-ink/70 to-transparent"
                />
                <div className="absolute inset-x-0 top-0 flex justify-end p-6">
                  <span className="rounded-sm bg-lime px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-ink uppercase">
                    Scout Fantasy
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.25em] text-lime uppercase">{"// Fantasy sports"}</p>
                    <p className="text-3xl leading-tight font-semibold text-off">
                      Daily fantasy
                      <br />
                      för din sportsbook.
                    </p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-lime px-4 py-2 text-xs font-bold tracking-wider text-ink uppercase">
                    Läs mer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
                <EndCard visible={ended.fantasy} tagline="Spot the play. Power the platform." />
                <div aria-hidden="true" className="absolute inset-0 mix-blend-soft-light" style={SHINE} />
              </div>
            </div>
          </Link>

          <div className="absolute top-6 left-6 flex gap-2">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={muted ? "Sätt på ljudet i videon" : "Stäng av ljudet i videon"}
              aria-pressed={!muted}
              className={CONTROL}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={replay}
              aria-label="Spela videon igen"
              tabIndex={ended[active] ? 0 : -1}
              className={`${CONTROL} ${ended[active] ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {projectile && (
        <div
          key={projectile.id}
          aria-hidden="true"
          onAnimationEnd={() => setProjectile(null)}
          className={`animate-impact pointer-events-none absolute top-1/2 left-1/2 z-20 ${
            projectile.kind === "card" ? "w-24 md:w-32" : "w-20 md:w-28"
          }`}
          style={projectileStyle(projectile)}
        >
          {projectile.kind === "card" ? (
            <DecoCard rank={projectile.rank} suit={projectile.suit} />
          ) : (
            <DealerButton />
          )}
        </div>
      )}
    </div>
  )
}
