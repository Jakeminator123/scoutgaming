import { ArrowRight } from "lucide-react";
import { PLAY_URL } from "@/lib/lobby-data";

const rows = [
  { label: "Spelrum", value: "Spel och miljö i ett val", note: "Varje rum har en speltyp och en publicerad miljö." },
  { label: "Dealers", value: "Utvalda av ditt spelbolag", note: "Du väljer bland de dealers som är tillåtna i rummet." },
  { label: "Saldo", value: "Demokrediter, inga riktiga pengar", note: "Logga in för egen profil och historik." },
];

export function HowItWorksSection() {
  return (
    <section className="relative border-t border-border bg-card py-20 md:py-28">
      <div className="px-5 md:px-10 lg:px-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow">{"// Så fungerar det"}</p>
            <h2 className="display mt-3 text-balance text-4xl text-off md:text-5xl">
              Tre steg. <span className="font-serif font-medium italic text-muted-foreground">Sedan sitter du.</span>
            </h2>
            <p className="mt-5 max-w-sm text-pretty leading-relaxed text-muted-foreground">
              Välj bolag, sedan spelrum med dess miljö och till sist en tillåten dealer.
              Spelknappen öppnar den befintliga spelvyn med ditt bolag, rum och dealer.
            </p>
            <a
              href={PLAY_URL}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-85"
            >
              Till spellobbyn
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <dl className="lg:col-span-8">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 border-t border-border py-6 md:grid-cols-[6rem_1fr_auto] md:gap-x-10 last:border-b"
              >
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="mr-3 text-lime">{String(i + 1).padStart(2, "0")}</span>
                  {row.label}
                </dt>
                <dd className="display text-2xl text-off md:text-3xl">{row.value}</dd>
                <dd className="col-start-2 mt-1 text-sm text-muted-foreground md:col-start-3 md:mt-0 md:max-w-[16rem] md:text-right">
                  {row.note}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
