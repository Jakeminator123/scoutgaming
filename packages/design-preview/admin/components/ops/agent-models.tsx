"use client"

import { useState } from "react"
import { useStudio } from "@/components/studio/studio-provider"
import { Page, PageHeader, Panel, StatusBadge, inputClass } from "./ui"

const MODELS = ["anthropic/claude-sonnet-4.5", "anthropic/claude-haiku-4.5", "openai/gpt-5-mini", "google/gemini-2.5-flash", "xai/grok-4-fast"]

const ROLES = [
  { id: "dealer-voice", name: "Dealer-repliker", hint: "Småprat och svar i chatten vid bordet", model: "anthropic/claude-haiku-4.5", latency: 420, cost: "0,8 kr / 1k rundor" },
  { id: "clip-director", name: "Klippval", hint: "Väljer nästa klipp i klippkartan utifrån händelse", model: "openai/gpt-5-mini", latency: 180, cost: "0,3 kr / 1k rundor" },
  { id: "moderation", name: "Chattmoderering", hint: "Filtrerar spelarchatt innan dealern svarar", model: "google/gemini-2.5-flash", latency: 95, cost: "0,1 kr / 1k meddelanden" },
  { id: "ops-assistant", name: "Intern assistent", hint: "Svarar i den interna agentchatten", model: "anthropic/claude-sonnet-4.5", latency: 1400, cost: "Per fråga" },
]

export function AgentModels() {
  const studio = useStudio()
  const [selected, setSelected] = useState<Record<string, string>>(Object.fromEntries(ROLES.map((role) => [role.id, role.model])))
  const canEdit = studio.accessLevel === 1

  const change = (roleId: string, roleName: string, model: string) => {
    const previous = selected[roleId]
    setSelected((current) => ({ ...current, [roleId]: model }))
    studio.log("AI", `${roleName}: ${previous} → ${model}`)
  }

  return (
    <Page>
      <PageHeader
        eyebrow="AI · OpenClaw"
        title="Agentmodeller"
        description="Vilken modell som driver varje roll i dealer-agenten. Byten slår igenom vid nästa runda och protokollförs. Exempeldata."
      />
      <Panel title="Roller" meta={canEdit ? "Nivå 1 kan byta modell" : "Läsläge"}>
        <ul className="divide-y divide-sg-line">
          {ROLES.map((role) => (
            <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{role.name}</p>
                <p className="text-[11px] text-sg-muted">{role.hint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <StatusBadge status="up" />
                <span className="font-mono text-sg-muted">{`p95 ${role.latency} ms`}</span>
                <span className="font-mono text-sg-muted">{role.cost}</span>
                <label htmlFor={`model-${role.id}`} className="sr-only">{`Modell för ${role.name}`}</label>
                <select
                  id={`model-${role.id}`}
                  value={selected[role.id]}
                  disabled={!canEdit}
                  onChange={(event) => change(role.id, role.name, event.target.value)}
                  className={`${inputClass} font-mono disabled:opacity-70`}
                >
                  {MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  )
}
