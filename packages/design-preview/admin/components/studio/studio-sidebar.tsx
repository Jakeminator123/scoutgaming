"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

type NavLink = { label: string; href: string }
type NavSection = { title: string; minLevel: number; badge?: string; links: NavLink[] }

const SECTIONS: NavSection[] = [
  {
    title: "Studio",
    minLevel: 3,
    links: [
      { label: "Klippkarta", href: "/control/clips" },
    ],
  },
  { title: "Drift", minLevel: 2, links: [{ label: "Översikt", href: "/control/drift" }] },
  { title: "Ekonomi", minLevel: 2, links: [{ label: "Intäkter & avtal", href: "/control/ekonomi" }] },
  {
    title: "AI",
    badge: "OpenClaw",
    minLevel: 2,
    links: [
      { label: "Agentmodeller", href: "/control/ai/models" },
      { label: "Intern agentchatt", href: "/control/ai/chat" },
    ],
  },
  {
    title: "Admin",
    badge: "Nivå 1",
    minLevel: 1,
    links: [
      { label: "Spelbolag", href: "/control/admin/operators" },
      { label: "Spelare & integritet", href: "/control/admin/players" },
      { label: "Betalningar & journal", href: "/control/admin/payments" },
      { label: "Konton & åtkomst", href: "/control/admin/accounts" },
      { label: "API & integrationer", href: "/control/admin/api" },
      { label: "Protokoll", href: "/control/admin/log" },
    ],
  },
]

export function StudioSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-sg-line bg-sg-bg md:flex">
      <div className="px-4 py-4">
        <p className="text-base font-semibold tracking-tight">scout/gaming</p>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-sg-teal">Croupier studio</p>
      </div>
      <nav aria-label="Huvudmeny" className="flex flex-1 flex-col gap-3 overflow-y-auto px-2 pb-4 text-sm">
        {SECTIONS.map((section) => {
          return (
            <div key={section.title}>
              <p className="flex items-center justify-between px-2 py-1 font-medium">
                <span className="flex items-center gap-2">
                  {section.title}
                  {section.badge && (
                    <span className="rounded bg-sg-panel px-1.5 py-0.5 font-mono text-[9px] font-normal uppercase tracking-wider text-sg-muted">
                      {section.badge}
                    </span>
                  )}
                </span>
              </p>
              <ul className="ml-3 flex flex-col gap-0.5 border-l border-sg-line pl-2">
                {section.links.map((link) => {
                  const active = pathname === link.href
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block rounded px-2 py-1.5 text-xs",
                          active ? "bg-sg-panel text-sg-lime" : "text-sg-muted hover:text-sg-text",
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
      <div className="border-t border-sg-line px-4 py-3">
        <p className="text-xs font-medium">Intern administration · Nivå 1</p>
        <nav aria-label="Portaler" className="mt-2 flex flex-col gap-2 text-xs text-sg-muted">
          <a href="/partner" className="hover:text-sg-text">2 · Spelbolagsportal ↗</a>
          <a href="/play" className="hover:text-sg-text">3 · Spelarvy ↗</a>
          <a href="/admin/lobby" className="hover:text-sg-text">Ny spellobby ↗</a>
        </nav>
      </div>
    </aside>
  )
}
