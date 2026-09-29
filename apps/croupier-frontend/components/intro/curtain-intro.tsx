"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { createMatteRenderer } from "@/lib/matte-renderer"
import { setIntroHandoff } from "@/lib/intro-handoff"
import { RetroSite } from "./retro-site"
import { IntroPlayingCard, type Box } from "./intro-playing-card"
import {
  CURTAIN_GONE,
  LAYER_SWITCH,
  computeMetrics,
  curtainFrame,
  stripCount,
  stripWidth,
  type StageMetrics,
} from "./curtain-math"

type Clip = "intro" | "curtain" | "outro"
type Phase = Clip | "card" | "leaving" | "done"

const CLIPS: Clip[] = ["intro", "curtain", "outro"]
const NEXT: Record<Clip, Phase> = { intro: "curtain", curtain: "outro", outro: "card" }
const SRC: Record<Clip, string> = {
  intro: "/videos/intro/astrid-walk.mp4",
  curtain: "/videos/intro/astrid-drag.mp4",
  outro: "/videos/intro/astrid-natural.mp4",
}
/** If a clip has not finished by then it is stuck loading; the site must not stay covered. */
const CLIP_TIMEOUT_MS: Record<Clip, number> = { intro: 10000, curtain: 10000, outro: 12000 }
const LEAVE_MS = 700
const FRAME = { w: 960, h: 1280 }
/** She has walked in and turned to face us by this point in the walk clip (seconds). */
const WALK_END = 6
/** The seat ball rolls in behind her while she is still standing (natural clip, seconds). */
const SEAT_ROLL = { start: 1.9, end: 3.6, distance: 1.8 }
/** Slightly slower than the source so her 2D walk-in reads as calm rather than hurried. */
const WALK_RATE = 0.85
/** Classic black-and-white football: a centre pentagon, five edge pentagons and the hexagon seams. */
const FOOTBALL_PANELS = [
  "50.0,35.0 64.3,45.4 58.8,62.1 41.2,62.1 35.7,45.4",
  "50.0,19.0 36.7,9.3 41.8,-6.3 58.2,-6.3 63.3,9.3",
  "79.5,40.4 84.6,24.8 101.0,24.8 106.1,40.4 92.8,50.1",
  "68.2,75.1 84.7,75.1 89.8,90.7 76.5,100.4 63.1,90.7",
  "31.8,75.1 36.9,90.7 23.5,100.4 10.2,90.7 15.3,75.1",
  "20.5,40.4 7.2,50.1 -6.1,40.4 -1.0,24.8 15.4,24.8",
]
const FOOTBALL_SEAMS =
  "M50 35L50 19M64.3 45.4L79.5 40.4M58.8 62.1L68.2 75.1M41.2 62.1L31.8 75.1M35.7 45.4L20.5 40.4M63.3 9.3L84.6 24.8M92.8 50.1L84.7 75.1M63.1 90.7L36.9 90.7M15.3 75.1L7.2 50.1M15.4 24.8L36.7 9.3"
/** Her seated pose in the natural clip, in source pixels of the 960x1280 frame. */
const SEAT = {
  /** She has sat down and gone still by this point in the clip (seconds). */
  settled: 6.2,
  moveStart: 0.3,
  moveEnd: 6,
  top: 322,
  bottom: 1234,
  headX: 476,
  faceY: 425,
}
const HERO_RATIO = 440 / 720

// Survives client-side navigation and resets with a full page load: the intro is a loading screen,
// so coming back from /demo should not replay it.
let introPlayed = false

const Retro = memo(RetroSite)

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const smooth = (t: number) => {
  const c = clamp01(t)
  return c * c * (3 - 2 * c)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** The hero card, when it is on screen beside the headline (desktop layout). */
function heroRect(vw: number, vh: number): Box | null {
  if (vw < 1024) return null
  const rect = document.querySelector("[data-intro-target]")?.getBoundingClientRect()
  if (!rect || rect.width < 50 || rect.top < 0 || rect.bottom > vh) return null
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

/** Where the playing card ends up: the hero card, or a card of the same shape where she stands. */
function cardTarget(m: StageMetrics): Box {
  const hero = heroRect(m.vw, m.vh)
  if (hero) return hero
  const height = Math.min(720, m.vh * 0.62, (m.vw * 0.8) / HERO_RATIO)
  const width = height * HERO_RATIO
  const centerX = m.videoLeft + (SEAT.headX / FRAME.w) * m.videoW
  return { left: centerX - width / 2, top: (m.vh - height) / 2, width, height }
}

/** The video box that puts her seated figure inside the card, head centred near the top. */
function seatBox(card: Box): Box {
  const scale = (card.height * 0.86) / (SEAT.bottom - SEAT.top)
  return {
    left: card.left + card.width / 2 - SEAT.headX * scale,
    top: card.top + card.height * 0.07 - SEAT.top * scale,
    width: FRAME.w * scale,
    height: FRAME.h * scale,
  }
}

function measureStage(root: HTMLElement): StageMetrics {
  const vw = root.clientWidth
  const vh = root.clientHeight
  const hero = heroRect(vw, vh)
  return computeMetrics(vw, vh, hero ? hero.left + hero.width / 2 : undefined)
}

type Seat = { card: Box; seat: Box }

/**
 * Loading-screen intro. A Windows 95 desktop covers the real site while it loads; Astrid walks
 * in as a 2D figure, becomes a 3D avatar, grabs the old page like a curtain and flings it off
 * screen, then turns photoreal and sits down where the hero card will be. A Scout Gaming playing
 * card lands on her face and grows into the hero card, whose video opens on that same face.
 * Skippable with the button or Escape.
 */
export function CurtainIntro() {
  const [phase, setPhase] = useState<Phase>("intro")
  const [metrics, setMetrics] = useState<StageMetrics | null>(null)
  const [curtainGone, setCurtainGone] = useState(false)
  const [cardPlan, setCardPlan] = useState<{ face: { x: number; y: number }; target: Box } | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const seatBallRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<Record<Clip, HTMLVideoElement | null>>({ intro: null, curtain: null, outro: null })
  const stripRefs = useRef<(HTMLDivElement | null)[]>([])
  const shadeRefs = useRef<(HTMLDivElement | null)[]>([])
  const phaseRef = useRef<Phase>("intro")
  const metricsRef = useRef<StageMetrics | null>(null)
  const seatRef = useRef<Seat | null>(null)
  const goneRef = useRef(false)
  const startedAt = useRef(0)
  const lastSheet = useRef<"static" | "strips">("static")

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const active = phase !== "done"

  // Play once per page load, and never for people who asked for less motion.
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (introPlayed || reduceMotion) {
      setPhase("done")
      return
    }
    introPlayed = true
    startedAt.current = performance.now()
    setIntroHandoff("holding")
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!active || !root) return
    const measure = () => {
      const next = measureStage(root)
      metricsRef.current = next
      setMetrics(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [active])

  const dealCard = useCallback(() => {
    if (phaseRef.current !== "outro") return
    phaseRef.current = "card"
    const plan = seatRef.current
    if (!plan) {
      setPhase("leaving")
      return
    }
    const scale = plan.seat.width / FRAME.w
    setCardPlan({
      face: { x: plan.seat.left + SEAT.headX * scale, y: plan.seat.top + SEAT.faceY * scale },
      target: plan.card,
    })
    setPhase("card")
  }, [])

  // The walk clip ends on a long idle; the curtain starts as soon as she faces us.
  const walkedIn = useCallback(() => setPhase((current) => (current === "intro" ? "curtain" : current)), [])

  // One clip per phase; the next phase starts when the clip ends.
  useEffect(() => {
    if (phase !== "intro" && phase !== "curtain" && phase !== "outro") return
    const video = videoRefs.current[phase]
    if (!video) return
    const m = metricsRef.current
    if (phase === "outro") {
      if (!goneRef.current) {
        goneRef.current = true
        setCurtainGone(true)
      }
      if (m) {
        const card = cardTarget(m)
        seatRef.current = { card, seat: seatBox(card) }
      }
    }
    const advance = () => (phase === "outro" ? dealCard() : setPhase(NEXT[phase]))
    // Backs up the per-frame check in throttled tabs, where animation frames can be rare.
    const seated = () => {
      if (phase === "outro" && video.currentTime >= SEAT.settled) dealCard()
      if (phase === "intro" && video.currentTime >= WALK_END) walkedIn()
    }
    const bail = () => setPhase("leaving")
    const guard = setTimeout(bail, CLIP_TIMEOUT_MS[phase])
    video.currentTime = 0
    video.addEventListener("ended", advance)
    video.addEventListener("timeupdate", seated)
    video.addEventListener("error", bail)
    video.playbackRate = phase === "intro" ? WALK_RATE : 1
    video.play().catch(bail)
    return () => {
      clearTimeout(guard)
      video.removeEventListener("ended", advance)
      video.removeEventListener("timeupdate", seated)
      video.removeEventListener("error", bail)
    }
  }, [phase, dealCard, walkedIn])

  useEffect(() => {
    if (phase !== "leaving") return
    setIntroHandoff("revealed")
    for (const clip of CLIPS) videoRefs.current[clip]?.pause()
    const timer = setTimeout(() => setPhase("done"), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  const skip = useCallback(() => setPhase((current) => (current === "done" ? current : "leaving")), [])
  const finishCard = useCallback(() => setPhase((current) => (current === "card" ? "leaving" : current)), [])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, skip])

  // Draws the current clip through the matte and, during the curtain clip, moves the strips.
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    const renderer = canvas ? createMatteRenderer(canvas) : null
    const skews: number[] = []
    const prevX: number[] = []
    let prevTime = performance.now()
    let raf = 0
    let shown: Clip = "intro"
    let boxStyle = ""

    // The box follows whichever clip is actually on the canvas.
    const layoutAvatar = (m: StageMetrics) => {
      const box = avatarRef.current
      if (!box) return
      let left = m.videoLeft
      let top = m.videoTop
      let width = m.videoW
      let height = m.videoH
      let roll = 1
      if (shown === "outro" && seatRef.current) {
        // She drifts to her seat while turning photoreal and sitting down.
        const t = videoRefs.current.outro?.currentTime ?? 0
        const p = smooth((t - SEAT.moveStart) / (SEAT.moveEnd - SEAT.moveStart))
        const { seat } = seatRef.current
        left = lerp(m.videoLeft, seat.left, p)
        top = lerp(m.videoTop, seat.top, p)
        width = lerp(m.videoW, seat.width, p)
        height = lerp(m.videoH, seat.height, p)
        roll = clamp01((t - SEAT_ROLL.start) / (SEAT_ROLL.end - SEAT_ROLL.start))
      }
      const ball = seatBallRef.current
      if (ball) {
        const visible = shown === "outro"
        // Decelerates like a ball losing momentum, and spins by the distance it covers.
        const remaining = visible ? (1 - roll) * (1 - roll) : 1
        ball.style.opacity = visible ? "1" : "0"
        ball.style.transform = `translateX(${(remaining * SEAT_ROLL.distance * 100).toFixed(2)}%)`
        ball.style.setProperty("--spin", `${(-(remaining * SEAT_ROLL.distance * 360) / Math.PI).toFixed(1)}deg`)
      }
      box.toggleAttribute("data-entering", shown === "intro")
      const next = `${left.toFixed(1)}|${top.toFixed(1)}|${width.toFixed(1)}|${height.toFixed(1)}`
      if (next === boxStyle) return
      boxStyle = next
      box.style.left = `${left.toFixed(1)}px`
      box.style.top = `${top.toFixed(1)}px`
      box.style.width = `${width.toFixed(1)}px`
      box.style.height = `${height.toFixed(1)}px`
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const current = phaseRef.current
      const clip: Clip | null =
        current === "intro" || current === "curtain" || current === "outro"
          ? current
          : current === "card" || current === "leaving"
            ? "outro"
            : null
      const video = clip ? videoRefs.current[clip] : null
      if (clip && video && renderer?.draw(video)) shown = clip

      const m = metricsRef.current
      if (m) layoutAvatar(m)
      if (current === "outro" && video && video.currentTime >= SEAT.settled) dealCard()
      if (current === "intro" && video && video.currentTime >= WALK_END) walkedIn()
      const dt = Math.max(1 / 240, (now - prevTime) / 1000)
      prevTime = now
      if (!m || current !== "curtain" || goneRef.current || !video) return

      const g = video.currentTime
      const count = stripRefs.current.length
      const frame = curtainFrame(g, m, count)
      for (let i = 0; i < count; i++) {
        const strip = stripRefs.current[i]
        if (!strip) continue
        const { x, y, sx, shade } = frame.poses[i]
        const vx = (x - (prevX[i] ?? x)) / dt
        prevX[i] = x
        // The hem trails the grip: fast strips lean away from their direction of travel.
        const targetSkew = Math.max(-24, Math.min(24, -vx * 0.011))
        skews[i] = (skews[i] ?? 0) + (targetSkew - (skews[i] ?? 0)) * 0.3
        strip.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) skewX(${skews[i].toFixed(2)}deg) scaleX(${sx.toFixed(4)})`
        const shadeEl = shadeRefs.current[i]
        if (shadeEl) shadeEl.style.opacity = shade.toFixed(3)
      }
      const shadow = shadowRef.current
      if (shadow) {
        const width = Math.max(1, frame.right - frame.left) + 80
        shadow.style.transform = `translateX(${(frame.left - 40).toFixed(1)}px) scaleX(${(width / m.vw).toFixed(4)})`
        shadow.style.opacity = (frame.bunch * 0.85).toFixed(3)
      }
      const root = rootRef.current
      if (root && g >= LAYER_SWITCH && !root.hasAttribute("data-above")) root.setAttribute("data-above", "")
      if (frame.gone || g >= CURTAIN_GONE) {
        goneRef.current = true
        setCurtainGone(true)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      renderer?.dispose()
    }
  }, [active, dealCard, walkedIn])

  const count = metrics ? stripCount(metrics.vw) : 0
  const strips = useMemo(() => {
    if (!metrics) return null
    const width = stripWidth(metrics.vw, count)
    stripRefs.current.length = count
    shadeRefs.current.length = count
    return Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="intro-strip"
        style={{ left: i * width, width }}
        ref={(el) => {
          stripRefs.current[i] = el
        }}
      >
        <div className="intro-strip-inner" style={{ left: -i * width, width: metrics.vw }}>
          <Retro />
        </div>
        <div
          className="intro-strip-shade"
          ref={(el) => {
            shadeRefs.current[i] = el
          }}
        />
      </div>
    ))
    // Only the viewport size changes the strip layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics?.vw, metrics?.vh, count])

  if (phase === "intro") lastSheet.current = "static"
  else if (phase === "curtain") lastSheet.current = "strips"
  const sheet: "static" | "strips" | "none" = curtainGone
    ? "none"
    : phase === "intro"
      ? "static"
      : phase === "curtain"
        ? "strips"
        : lastSheet.current

  // The clones' CSS animations are offset by how long the static page has already been showing.
  const stripsElapsed = useMemo(
    () => (sheet === "strips" ? (performance.now() - startedAt.current) / 1000 : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet === "strips"],
  )

  if (!active) return null

  return (
    <div
      ref={rootRef}
      className="intro-root"
      data-stage={curtainGone ? "after" : "before"}
      data-leaving={phase === "leaving" ? "" : undefined}
      role="region"
      aria-label="Intro"
    >
      {sheet === "static" && (
        <div className="intro-static" aria-hidden="true">
          <Retro />
        </div>
      )}
      {sheet === "strips" && metrics && (
        <div className="intro-curtain" aria-hidden="true" style={{ "--elapsed": `${stripsElapsed.toFixed(3)}s` } as CSSProperties}>
          <div ref={shadowRef} className="intro-shadow" style={{ left: 0, width: metrics.vw, opacity: 0 }} />
          {strips}
        </div>
      )}

      <div
        ref={avatarRef}
        className="intro-avatar"
        aria-hidden="true"
        data-hidden={phase === "leaving" ? "" : undefined}
        style={metrics ? undefined : { visibility: "hidden" }}
      >
        <div ref={seatBallRef} className="intro-seat">
          <div className="intro-seat-shadow" />
          <div className="intro-seat-ball">
            <svg viewBox="0 0 100 100" className="intro-seat-seams" aria-hidden="true">
              {FOOTBALL_PANELS.map((points) => (
                <polygon key={points} points={points} className="intro-seat-panel" />
              ))}
              <path d={FOOTBALL_SEAMS} />
            </svg>
            <div className="intro-seat-shade" />
          </div>
        </div>
        <canvas ref={canvasRef} width={FRAME.w} height={FRAME.h} />
        {CLIPS.map((clip) => (
          <video
            key={clip}
            ref={(el) => {
              videoRefs.current[clip] = el
            }}
            src={SRC[clip]}
            muted
            playsInline
            preload="auto"
          />
        ))}
      </div>

      {cardPlan && (phase === "card" || phase === "leaving") && (
        <IntroPlayingCard face={cardPlan.face} target={cardPlan.target} onDone={finishCard} />
      )}

      <button type="button" className="intro-skip" data-look={curtainGone ? "modern" : "retro"} onClick={skip} autoFocus>
        {curtainGone ? "Hoppa över intro" : "Hoppa över intro »"}
      </button>
    </div>
  )
}
