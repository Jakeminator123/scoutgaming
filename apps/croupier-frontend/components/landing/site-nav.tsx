"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFantasyMode, type SiteMode } from "./fantasy-mode"
import { LogoLaser } from "./logo-laser"

const PRIMARY: { label: string; href: string; mode: SiteMode; isNew?: boolean }[] = [
  { label: "Scout Gaming", href: "https://scoutgaminggroup.com/", mode: "fantasy" },
  { label: "Blackjack", href: "/demo", mode: "live", isNew: true },
]

const glow = "transition-all duration-300 hover:text-lime hover:drop-shadow-[0_0_8px_var(--scout-lime)]"

export function SiteNav() {
  const { mode, setHover } = useFantasyMode()

  return (
    <header className="relative z-10 px-6 py-6 md:px-16 md:py-8">
      <nav aria-label="Huvudmeny" className="flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap lg:gap-6">
        <LogoLaser />

        <div className="hidden items-center gap-8 lg:flex lg:gap-10">
          <ul className="flex items-center gap-8 lg:gap-10">
            {PRIMARY.map((item) => (
              <li key={item.label} className="relative">
                <Link
                  href={item.href}
                  className={`cursor-pointer text-base font-bold tracking-[0.15em] text-off uppercase ${glow} ${
                    mode === item.mode ? "text-lime drop-shadow-[0_0_8px_var(--scout-lime)]" : ""
                  }`}
                  onPointerEnter={() => setHover(item.mode)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(item.mode)}
                  onBlur={() => setHover(null)}
                >
                  {item.label}
                </Link>
                {item.isNew && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 -rotate-6 rounded-sm bg-lime px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-ink uppercase">
                    Ny
                  </span>
                )}
              </li>
            ))}
            <li><Link href="/about" className={`text-base font-bold tracking-[0.15em] text-off uppercase ${glow}`}>Om oss</Link></li>
          </ul>

        </div>

        <Button
          asChild
          size="sm"
          className="min-h-11 shrink-0 rounded-md bg-lime px-4 font-semibold text-ink transition-all duration-300 hover:bg-lime2 hover:shadow-[0_0_20px_var(--scout-lime)]"
        >
          <Link href="/demo">
            Öppna bordet <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </nav>
      <div className="mt-4 text-right lg:hidden"><Link href="/about" className="inline-flex min-h-11 items-center text-sm text-off/80 hover:text-lime">Om Scout <ArrowRight className="ml-2 h-3 w-3" aria-hidden="true" /></Link></div>
    </header>
  )
}
