import type { Metadata } from "next"
import { ArrowUpRight } from "lucide-react"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"
import { gameUrl } from "@/lib/game-url"


export const metadata: Metadata = {
  title: "Blackjack med Astrid · Pilot",
  description: "Öppna Croupiers serverstyrda blackjackbord med Astrid och demokrediter.",
}

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[65vh] max-w-4xl flex-col justify-center px-6 py-16">
        <p className="mb-4 font-mono text-xs tracking-[0.25em] text-lime uppercase">Blackjackpilot</p>
        <h1 className="mb-6 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Spela med Astrid
        </h1>
        <p className="mb-4 max-w-2xl text-lg text-muted-foreground">
          Det riktiga bordet är serverstyrt. Spelservern sköter kort, sko,
          demokrediter och utbetalningar. Öppna spelet på dess egen adress under pilotfasen.
        </p>
        <p className="mb-10 max-w-2xl text-sm text-muted-foreground">
          Det här är en teknisk demo utan riktiga pengar. Genererat tal och läppsynk är ännu inte
          godkända som en del av piloten.
        </p>
        <a
          href={gameUrl()}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-lime px-7 py-4 font-semibold text-ink transition-colors hover:bg-lime2"
        >
          Öppna det riktiga blackjackbordet <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        </a>
      </main>
      <SiteFooter />
    </>
  )
}
