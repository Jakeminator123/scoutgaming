"use client"

import type { ReactNode } from "react"
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Lock } from "lucide-react"
import { Page } from "./ui"

export function AccessGate({ minLevel, what, children }: { minLevel: AccessLevel; what: string; children: ReactNode }) {
  const { accessLevel } = useStudio()
  if (accessLevel <= minLevel) return <>{children}</>
  return (
    <Page>
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-sg-line bg-sg-panel px-4 py-6 text-sm text-sg-muted">
        <Lock className="size-4 text-sg-amber" aria-hidden />
        {`${what} kräver ${ACCESS_LEVELS[minLevel].label.toLowerCase()} eller högre. Byt nivå längst ned i menyn för att testa.`}
      </div>
    </Page>
  )
}
