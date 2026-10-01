"use client"

import Link from "next/link"
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { observeDecorativeMotion } from "@/lib/decorative-motion"

type Effects = typeof import("./desktop-effects")
const DesktopContext = createContext<Effects | null>(null)

// The server and every mobile/touch client get the complete, still landing page.
// Importing effects only after the capability check also avoids downloading their JS.
export function LandingExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const [effects, setEffects] = useState<Effects | null>(null)

  useEffect(() => {
    if (!root.current) return
    let revision = 0
    const stop = observeDecorativeMotion(root.current, enabled => {
      const current = ++revision
      if (!enabled) {
        setEffects(null)
        return
      }
      import("./desktop-effects").then(module => {
        // A resize, pagehide or unmount can happen while the chunk is in flight.
        if (current === revision) setEffects(module)
      }).catch(() => { /* Optional decoration must never block the working page. */ })
    })
    return () => { revision++; stop() }
  }, [])

  return (
    <DesktopContext.Provider value={effects}>
      <div ref={root} data-landing-motion={effects ? "desktop" : "static"}>{children}</div>
    </DesktopContext.Provider>
  )
}

export function LandingEffects() {
  const effects = useContext(DesktopContext)
  return effects ? <effects.DesktopEffects /> : null
}

export function LandingLogo() {
  const effects = useContext(DesktopContext)
  return effects ? <effects.LogoLaser /> : (
    <Link href="/" aria-label="Scout Gaming Group, startsida" className="text-xl font-semibold tracking-tight text-off">
      scout<span className="text-lime">/</span>gaming
    </Link>
  )
}

export function LandingHero() {
  const effects = useContext(DesktopContext)
  return effects ? <effects.HeroCard /> : (
    <Link href="/demo" aria-label="Öppna blackjackpiloten med Astrid"
      className="relative block w-full max-w-sm overflow-hidden rounded-2xl border border-off/20 bg-ink">
      {/* A still image needs neither an autoplay decoder nor a 3D compositing layer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/astrid-card-poster.jpg" width="640" height="960" decoding="async"
        alt="Astrid vid blackjackbordet" className="aspect-[2/3] w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent px-6 pt-16 pb-6">
        <p className="font-mono text-xs tracking-widest text-lime uppercase">Blackjackpilot</p>
        <p className="mt-2 text-3xl font-semibold text-off">Astrid</p>
        <span className="mt-4 inline-flex min-h-11 items-center rounded-full bg-lime px-5 text-sm font-semibold text-ink">Öppna bordet →</span>
      </div>
    </Link>
  )
}
