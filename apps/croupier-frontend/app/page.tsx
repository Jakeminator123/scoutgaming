import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FantasyModeProvider } from "@/components/landing/fantasy-mode"
import { SiteNav } from "@/components/landing/site-nav"

import { LandingExperience, LandingEffects, LandingHero } from "@/components/landing/landing-experience"

export default function Home() {
  return (
    <FantasyModeProvider>
      <LandingExperience>
        <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-ink via-[#111418] to-steel2 text-off">
          <LandingEffects />

          <SiteNav />

          <main className="relative z-10 flex flex-col items-center gap-12 px-6 pt-8 pb-32 md:px-16 lg:flex-row lg:items-center lg:justify-between lg:pt-12">
            <div className="max-w-2xl">
              <p className="mb-5 font-mono text-xs tracking-[0.25em] text-lime uppercase">
                {"// Blackjackpilot · Scout Gaming Group"}
              </p>
              <h1 className="mb-6 text-[clamp(2.25rem,9vw,3rem)] leading-[1.02] font-semibold tracking-tight text-off md:text-6xl lg:text-7xl">
                Möt Astrid.
                <br />
                <span className="text-lime">Live blackjack</span>
                <br />
                i vår pilot.
              </h1>
              <p className="mb-10 max-w-xl text-base leading-relaxed text-off/75 md:text-lg">
                Möt Astrid vid ett blackjackbord där spelservern sköter kort, sko, saldo och utbetalningar.
                Den här piloten använder demokrediter och öppnar den riktiga spelklienten.
              </p>

              <div className="mb-12 flex flex-wrap gap-4">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-lime px-8 text-sm font-semibold tracking-wide text-ink uppercase transition-all duration-300 hover:bg-lime2 hover:shadow-[0_0_20px_var(--scout-lime),0_0_40px_var(--scout-lime2)]"
                >
                  <Link href="/demo">
                    Öppna blackjack <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-2 border-off/70 bg-transparent px-8 text-sm font-semibold tracking-wide text-off uppercase transition-all duration-300 hover:border-lime hover:bg-off/10 hover:text-lime hover:shadow-[0_0_20px_var(--scout-lime)]"
                >
                  <a href="/videos/ai-casino-demo.mp4" target="_blank" rel="noreferrer">
                    Se videon
                  </a>
                </Button>
              </div>

              <div className="flex gap-3" aria-hidden="true">
                <div className="h-2.5 w-2.5 rounded-full bg-lime shadow-[0_0_8px_var(--scout-lime)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-off/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-off/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-off/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-off/30" />
              </div>
            </div>

            <LandingHero />
          </main>

          <p className="absolute right-6 bottom-8 left-6 z-10 font-mono text-[10px] tracking-[0.2em] text-steel uppercase md:right-16 md:bottom-12 md:left-auto">
            {"// 18+ · Demo utan riktiga pengar · © Scout Gaming Group"}
          </p>
        </div>
      </LandingExperience>
    </FantasyModeProvider>
  )
}
