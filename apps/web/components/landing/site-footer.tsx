export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 font-mono text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-3">
          <span className="rounded-sm border border-border px-1.5 py-0.5 text-foreground">18+</span>
          Demo med låtsasmarker. Inga riktiga pengar spelas.
        </p>
        <p>
          Spela ansvarsfullt ·{" "}
          <a
            href="https://www.stodlinjen.se"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline-offset-4 hover:underline"
          >
            stodlinjen.se
          </a>
        </p>
      </div>
    </footer>
  )
}
