"use client"

import { CardStream } from "./card-stream"
import { CroupierRide } from "./croupier-ride"
import { LightTrails } from "./light-trails"
import { Parallax } from "./parallax"
import { PerspectiveFloor } from "./perspective-floor"
import { parallaxStyle } from "./parallax-style"

export { HeroCard } from "./hero-card"
export { LogoLaser } from "./logo-laser"

// This entire module is a desktop-only enhancement, including its media and RAF loops.
export function DesktopEffects() {
  return (
    <>
      <Parallax />
      <PerspectiveFloor />
      <div aria-hidden="true" className="absolute -inset-16 bg-[radial-gradient(ellipse_at_72%_45%,rgba(200,164,106,0.16),transparent_50%),radial-gradient(ellipse_at_10%_100%,rgba(214,255,58,0.08),transparent_45%)]" style={parallaxStyle(12)} />
      <div aria-hidden="true" className="mode-tint mode-tint-live absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(230,191,110,0.28),transparent_55%),radial-gradient(ellipse_at_15%_90%,rgba(160,40,40,0.22),transparent_50%)]" />
      <div aria-hidden="true" className="mode-tint mode-tint-fantasy absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(214,255,58,0.16),transparent_55%),radial-gradient(ellipse_at_15%_90%,rgba(30,140,70,0.28),transparent_50%)]" />
      <div aria-hidden="true" className="absolute -inset-10" style={parallaxStyle(6, true)}><LightTrails /></div>
      <CardStream />
      <CroupierRide />
    </>
  )
}
