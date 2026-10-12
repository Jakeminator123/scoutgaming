"use client"

import { useState } from "react"
import { formatAt, type AuditCategory } from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Page, PageHeader, Panel, Td, Th } from "./ui"
import { cn } from "@/lib/utils"

const CATEGORIES: AuditCategory[] = ["Struktur", "Avtal", "Åtkomst", "API", "AI", "Integritet"]

export function AuditView() {
  const { audit } = useStudio()
  const [category, setCategory] = useState<AuditCategory | "all">("all")
  const entries = category === "all" ? audit : audit.filter((entry) => entry.category === category)

  return (
    <Page>
      <PageHeader
        eyebrow="Admin · Nivå 1"
        title="Protokoll"
        description="Varje ändring av struktur, andelar, revshare, åtkomst, nycklar och modeller loggas här med vem, när och varför. Kan inte redigeras."
      />
      <Panel
        title="Händelser"
        meta={`${entries.length} st`}
        action={
          <div role="group" aria-label="Filtrera kategori" className="flex flex-wrap gap-1">
            {(["all", ...CATEGORIES] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px]",
                  category === item ? "bg-sg-lime text-sg-bg" : "text-sg-muted hover:text-sg-text",
                )}
              >
                {item === "all" ? "Alla" : item}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-sg-line">
              <tr>
                <Th>Tid (UTC)</Th>
                <Th>Vem</Th>
                <Th>Kategori</Th>
                <Th>Händelse</Th>
                <Th>Anledning</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-line">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <Td className="whitespace-nowrap font-mono text-sg-muted">{formatAt(entry.at)}</Td>
                  <Td className="whitespace-nowrap">{entry.actor}</Td>
                  <Td>
                    <span className="rounded bg-sg-bg px-1.5 py-0.5 font-mono text-[10px] text-sg-teal">{entry.category}</span>
                  </Td>
                  <Td>{entry.action}</Td>
                  <Td className="text-sg-muted">{entry.reason ?? "–"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && <p className="px-4 py-6 text-xs text-sg-muted">Inga händelser i kategorin.</p>}
        </div>
      </Panel>
    </Page>
  )
}
