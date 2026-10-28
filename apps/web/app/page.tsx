// Server-rendered start page: plain markup, no client code, video or effects.
// /lobby is served by the Studio service, so it is an ordinary link rather
// than Next client navigation.
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col justify-center bg-gradient-to-br from-ink via-[#111418] to-steel2 px-4 py-12 text-off sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-[clamp(2.5rem,12vw,5rem)] leading-none font-semibold tracking-tight break-words">
          Scoutgaming
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-off/85">
          Live-dealer blackjack för spelbolag.
        </p>
        <a
          href="/lobby"
          className="mt-10 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-lime px-8 text-base font-semibold text-ink hover:bg-lime2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime"
        >
          Till lobbyn <span aria-hidden="true">→</span>
        </a>
      </div>
    </main>
  )
}
