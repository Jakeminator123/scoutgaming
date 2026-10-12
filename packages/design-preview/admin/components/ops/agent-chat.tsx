"use client"

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { Bot, SendHorizontal, UserRound } from "lucide-react"
import { RNGS, SERVICES, computeEconomy, formatSek } from "@/lib/ops"
import { useStudio } from "@/components/studio/studio-provider"
import { Page, PageHeader } from "./ui"
import { cn } from "@/lib/utils"

type Message = { id: string; from: "user" | "agent"; text: string }

const SUGGESTIONS = ["Hur ser driften ut?", "Vad har vi tjänat senaste 30 dagarna?", "Vilka dealers har revshare?"]

export function AgentChat() {
  const studio = useStudio()
  const [messages, setMessages] = useState<Message[]>([
    { id: "m0", from: "agent", text: "Hej! Jag är OpenClaw. Fråga om drift, intäkter eller dealers. I exempelläget svarar jag från studions data, ingen modell anropas." },
  ])
  const [draft, setDraft] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  const answer = (question: string) => {
    const q = question.toLowerCase()
    if (/drift|status|uppe|nere|render|rng/.test(q)) {
      const issues = [...SERVICES, ...RNGS].filter((item) => item.status !== "up")
      return issues.length
        ? `${issues.length} system har störning: ${issues.map((item) => item.name).join(", ")}. Övrigt är uppe. Se Drift för vilka rum som påverkas.`
        : "Alla tjänster och slumpgeneratorer är uppe."
    }
    if (/tjän|intäkt|netto|pengar|ggr/.test(q)) {
      const rows = computeEconomy({ ...studio }, studio.terms)
      const net = rows.reduce((sum, row) => sum + row.net, 0)
      const ggr = rows.reduce((sum, row) => sum + row.ggr, 0)
      return `Senaste 30 dagarna: GGR ${formatSek(ggr)}, vårt netto efter revshare ${formatSek(net)}.`
    }
    if (/revshare|kändis|dealer/.test(q)) {
      const stars = studio.dealers.filter((item) => item.kind === "celebrity")
      return stars.length
        ? `Kändisdealers med revshare: ${stars.map((item) => `${item.name} (${item.revsharePct} %)`).join(", ")}.`
        : "Ingen dealer har revshare just nu."
    }
    return "Det kan jag inte svara på i exempelläget. Prova att fråga om drift, intäkter eller dealers."
  }

  const send = (text: string) => {
    const value = text.trim()
    if (!value) return
    const stamp = Date.now().toString(36)
    setMessages((current) => [
      ...current,
      { id: `u-${stamp}`, from: "user", text: value },
      { id: `a-${stamp}`, from: "agent", text: answer(value) },
    ])
    setDraft("")
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    send(draft)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    send(draft)
  }

  return (
    <Page>
      <PageHeader eyebrow="AI · OpenClaw" title="Intern agentchatt" description="Fråga agenten om läget i studion. Endast för interna konton." />
      <section aria-label="Konversation" className="flex min-h-[420px] flex-1 flex-col rounded-lg border border-sg-line bg-sg-panel">
        <ol className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <li key={message.id} className={cn("flex max-w-2xl gap-2.5", message.from === "user" && "flex-row-reverse self-end")}>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  message.from === "agent" ? "bg-sg-lime/15 text-sg-lime" : "bg-sg-bg text-sg-muted",
                )}
              >
                {message.from === "agent" ? <Bot className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
                <span className="sr-only">{message.from === "agent" ? "OpenClaw" : "Du"}</span>
              </span>
              <p className={cn("rounded-lg px-3 py-2 text-sm", message.from === "agent" ? "bg-sg-bg" : "bg-sg-lime text-sg-bg")}>
                {message.text}
              </p>
            </li>
          ))}
          <div ref={endRef} />
        </ol>
        <div className="flex flex-wrap gap-1.5 border-t border-sg-line px-4 pt-3">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded-full border border-sg-line px-2.5 py-1 text-[11px] text-sg-muted hover:border-sg-lime/50 hover:text-sg-text"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-2 p-4">
          <label htmlFor="agent-input" className="sr-only">
            Meddelande
          </label>
          <textarea
            id="agent-input"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en fråga…"
            className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-sg-line bg-sg-bg px-3 py-2 text-sm outline-none placeholder:text-sg-muted focus:border-sg-lime/60"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Skicka"
            className="flex size-9 items-center justify-center rounded-md bg-sg-lime text-sg-bg disabled:opacity-40"
          >
            <SendHorizontal className="size-4" aria-hidden />
          </button>
        </form>
      </section>
    </Page>
  )
}
