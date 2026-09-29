"use client"

import { useEffect, useRef } from "react"
import { createMatteRenderer } from "@/lib/matte-renderer"

/** Draws a stacked-matte video onto a transparent canvas, so it composites over anything. */
function useMatteCanvas(videoRef: React.RefObject<HTMLVideoElement | null>, canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const renderer = createMatteRenderer(canvas)
    if (!renderer) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion) video.addEventListener("loadeddata", () => video.pause(), { once: true })

    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      renderer.draw(video)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      renderer.dispose()
    }
  }, [videoRef, canvasRef])
}

/** Restarts the croupier clip every time the ride animation loops, so both stay in step. */
function useRideSync(rideRef: React.RefObject<HTMLDivElement | null>, videoRef: React.RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const ride = rideRef.current
    const video = videoRef.current
    if (!ride || !video) return
    const restart = (event: AnimationEvent) => {
      if (event.animationName !== "croupier-ride") return
      video.currentTime = 0
      void video.play().catch(() => {})
    }
    ride.addEventListener("animationiteration", restart)
    return () => ride.removeEventListener("animationiteration", restart)
  }, [rideRef, videoRef])
}

// Skims in along the floor from the right edge and ends exactly where the card is conjured, so the
// thread visibly pours into the spot the card unfolds from.
const STREAK_PATH = "M 1720 350 C 1460 344, 1200 300, 928 266"

/**
 * Three croupiers standing on an ace of spades. Once every clip loop a lime thread skims in
 * along the floor; the card unfolds from the point it is absorbed into, glides out past the left
 * edge and is gone before the clip restarts. It belongs to the casino, so the whole stage fades
 * away while the page is in fantasy mode.
 */
export function CroupierRide() {
  const rideRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useMatteCanvas(videoRef, canvasRef)
  useRideSync(rideRef, videoRef)

  return (
    <div aria-hidden="true" className="croupier-stage pointer-events-none absolute inset-x-0 bottom-0 z-[5] hidden h-[420px] md:block">
      <svg className="croupier-streak absolute inset-0 h-full w-full" viewBox="0 0 1600 420" preserveAspectRatio="none">
        <defs>
          <linearGradient id="croupier-streak-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#f2ffb0" stopOpacity="1" />
            <stop offset="0.35" stopColor="#d6ff3a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#b5dc1f" stopOpacity="0" />
          </linearGradient>
          <filter id="croupier-streak-blur" x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <path
          d={STREAK_PATH}
          pathLength={2000}
          fill="none"
          stroke="url(#croupier-streak-grad)"
          strokeWidth={14}
          strokeLinecap="round"
          filter="url(#croupier-streak-blur)"
          className="croupier-streak-glow"
        />
        <path
          d={STREAK_PATH}
          pathLength={2000}
          fill="none"
          stroke="url(#croupier-streak-grad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="croupier-streak-core"
        />
      </svg>

      <div ref={rideRef} className="croupier-ride absolute bottom-[84px] left-0 h-[400px] w-[540px] will-change-transform">
        <div className="croupier-flash" />
        <div className="croupier-scene absolute inset-0">
          <div className="croupier-card">
            <span className="croupier-index croupier-index-tl">
              A<span className="block leading-none">♠</span>
            </span>
            <span className="croupier-pip">♠</span>
            <span className="croupier-index croupier-index-br">
              A<span className="block leading-none">♠</span>
            </span>
          </div>
          <div className="croupier-shadow" />
          <canvas ref={canvasRef} className="croupier-figures" />
          <video
            ref={videoRef}
            src="/videos/croupiers-matte.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="pointer-events-none absolute h-px w-px opacity-0"
          />
        </div>
      </div>
    </div>
  )
}
