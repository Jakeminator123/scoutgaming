import { ArrowUpRight } from "lucide-react";
import { ScoutLogo } from "@/components/scout-logo";
import { HOME_URL } from "@/lib/lobby-data";

export function FooterSection() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="flex flex-col gap-8 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-10 lg:px-16">
        <div>
          <ScoutLogo className="text-lg" />
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Utbud och miljöval bestäms av respektive spelbolag. Lobbyn hämtar publicerat utbud från det gemensamma registret.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]">
            18+ · Demo utan riktiga pengar
          </span>
          <a href="https://stodlinjen.se" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            Spelansvar
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
          <a href={HOME_URL} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            Till startsidan
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
      <div className="border-t border-border px-5 py-4 md:px-10 lg:px-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          © {new Date().getFullYear()} Scout Gaming Group · Spellobby
        </p>
      </div>
    </footer>
  );
}
