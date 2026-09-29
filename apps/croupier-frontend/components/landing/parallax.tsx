"use client"

import { useEffect } from "react"

/**
 * Tracks the pointer and exposes it as smoothed CSS variables on <html>:
 * --mx / --my in the range -1..1 (0 at the viewport centre).
 * Layers read them with calc() to move at different depths.
 */
export function Parallax() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (window.matchMedia("(pointer: coarse)").matches) return

    const root = document.documentElement
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }

    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1
      target.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    const onLeave = () => {
      target.x = 0
      target.y = 0
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    document.documentElement.addEventListener("pointerleave", onLeave)

    let raf = 0
    const tick = () => {
      current.x += (target.x - current.x) * 0.045
      current.y += (target.y - current.y) * 0.045
      root.style.setProperty("--mx", current.x.toFixed(4))
      root.style.setProperty("--my", current.y.toFixed(4))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("pointermove", onMove)
      document.documentElement.removeEventListener("pointerleave", onLeave)
      root.style.removeProperty("--mx")
      root.style.removeProperty("--my")
    }
  }, [])

  return null
}
