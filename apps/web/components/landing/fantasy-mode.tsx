"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type SiteMode = "casino" | "fantasy" | "live"
export type Face = "casino" | "fantasy"

interface SiteModeValue {
  /** What the page shows right now: a hovered nav item always wins, otherwise the hero card's own cycle. */
  mode: SiteMode
  hover: SiteMode | null
  auto: Face
  fantasy: boolean
  setHover: (mode: SiteMode | null) => void
  setAuto: (face: Face) => void
}

const SiteModeContext = createContext<SiteModeValue>({
  mode: "casino",
  hover: null,
  auto: "casino",
  fantasy: false,
  setHover: () => {},
  setAuto: () => {},
})

export function FantasyModeProvider({ children }: { children: ReactNode }) {
  const [hover, setHover] = useState<SiteMode | null>(null)
  const [auto, setAuto] = useState<Face>("casino")
  const mode = hover ?? auto

  const value = useMemo<SiteModeValue>(
    () => ({ mode, hover, auto, fantasy: mode === "fantasy", setHover, setAuto }),
    [mode, hover, auto],
  )

  return (
    <SiteModeContext.Provider value={value}>
      <div data-mode={mode} className="contents">
        {children}
      </div>
    </SiteModeContext.Provider>
  )
}

export function useFantasyMode() {
  return useContext(SiteModeContext)
}
