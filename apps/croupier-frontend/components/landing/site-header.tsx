import Link from "next/link"
import { Button } from "@/components/ui/button"
import { gameUrl } from "@/lib/game-url"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-baseline gap-3" aria-label="Scout Gaming Group, startsida">
          <span className="font-sans text-xl font-semibold tracking-tight text-foreground">
            scout<span className="text-lime">/</span>gaming
          </span>
          <span className="hidden font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase sm:inline">
            {"// Astrid · Blackjack"}
          </span>
        </Link>
        <nav aria-label="Huvudmeny" className="flex items-center gap-8">
          <ul className="hidden items-center gap-8 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase md:flex">
            <li>
              <Link href="/" className="transition-colors hover:text-foreground">
                Start
              </Link>
            </li>
          </ul>
          <Button asChild size="sm" className="bg-lime font-mono text-xs tracking-widest text-ink uppercase hover:bg-lime2">
            <a href={gameUrl()}>Öppna bordet</a>
          </Button>
        </nav>
      </div>
    </header>
  )
}
