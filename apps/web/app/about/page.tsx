import type { Metadata } from "next"
import Link from "next/link"
import { ArrowDown, ArrowUpRight } from "lucide-react"
import { AboutLounge } from "@/components/about/about-lounge"
import "./about.css"

export const metadata: Metadata = {
  metadataBase: new URL("https://croupier-frontend.vercel.app"),
  title: "Om Scout · Människorna bakom nästa kapitel",
  description: "Lär känna Scout Gaming. Från fantasy sports till AI live casino, med människor och idéer från Stockholm, Malta och Lviv.",
  openGraph: {
    title: "Om Scout · Människorna bakom nästa kapitel",
    description: "En gemensam riktning. Ett nytt kapitel för Scout Gaming.",
    images: [{ url: "/about/scout-lounge.png", width: 1536, height: 864, alt: "Scout Gaming-loungen" }],
    locale: "sv_SE",
    type: "website",
  },
}

const offices = [
  { number: "01", city: "Stockholm", region: "Sverige", focus: "Strategi & partnerskap", coordinates: "59°20′ N · 18°04′ E" },
  { number: "02", city: "Malta", region: "Medelhavet", focus: "Verksamhet & regelefterlevnad", coordinates: "35°54′ N · 14°30′ E" },
  { number: "03", city: "Lviv", region: "Ukraina", focus: "Utveckling & teknik", coordinates: "49°50′ N · 24°02′ E" },
]

export default function AboutPage() {
  return (
    <div className="scout-about">
      <a className="about-skip" href="#var-historia">Hoppa till innehållet</a>
      <header className="about-header">
        <Link className="about-wordmark" href="/" aria-label="Scout Gaming, startsida">scout<span>/</span>gaming</Link>
        <nav aria-label="Huvudmeny" className="about-nav">
          <a className="about-nav-product" href="https://scoutgaminggroup.com/fantasy">Fantasy sports</a>
          <Link className="about-nav-product" href="/lobby">AI live casino</Link>
          <Link href="/about" aria-current="page">Om oss<span className="about-nav-dot" /></Link>
        </nav>
        <a className="about-contact-link" href="mailto:hello@scoutgaminggroup.com">Säg hej <ArrowUpRight size={16} aria-hidden="true" /></a>
      </header>

      <main>
        <AboutLounge />

        <section className="about-story about-container" id="var-historia" aria-labelledby="story-title">
          <div className="about-section-label"><span>01 / VÅR HISTORIA</span><ArrowDown size={16} aria-hidden="true" /></div>
          <div className="about-story-content">
            <h2 id="story-title">Erfarenhet i grunden.<br /><em>Nyfikenhet i allt.</em></h2>
            <div className="about-story-copy">
              <p>Scout föddes i Stockholm 2013 med en idé om att göra sport mer engagerande. Sedan dess har vi byggt fantasyteknik för speloperatörer och deras spelare.</p>
              <p>2026 började ett nytt kapitel. Med Impact Win som ägare och ett nytt ledarskap utvecklar vi nästa generation av Scout, tillsammans med våra partners.</p>
              <a className="about-text-link" href="https://scoutgaminggroup.com/about" target="_blank" rel="noreferrer">Hela berättelsen om Scout <ArrowUpRight size={17} aria-hidden="true" /></a>
            </div>
          </div>
          <dl className="about-numbers">
            <div><dt>Vår historia började</dt><dd>2013<span>STOCKHOLM, SVERIGE</span></dd></div>
            <div><dt>Kontor, en gemensam riktning</dt><dd>03<span>STOCKHOLM · MALTA · LVIV</span></dd></div>
            <div><dt>Ett nytt kapitel</dt><dd>2026<span>EN DEL AV IMPACT WIN</span></dd></div>
          </dl>
        </section>

        <section className="about-products" id="det-vi-bygger" aria-labelledby="products-title">
          <div className="about-container">
            <div className="about-section-label"><span>02 / DET VI BYGGER</span><span>NYA SÄTT ATT SPELA</span></div>
            <div className="about-products-heading"><h2 id="products-title">Från första draften<br />till <em>nästa giv.</em></h2><p>Sportens gemenskap. Spelbordets närvaro.<br />Två världar som möts i Scout.</p></div>
            <a className="about-product-row" href="https://scoutgaminggroup.com/fantasy" target="_blank" rel="noreferrer">
              <span className="about-product-number">01</span>
              <div><span className="about-kicker">BYGGT FÖR SPORTENS FANS</span><h3>Fantasy sports<span className="about-product-mark" aria-hidden="true">↗</span></h3></div>
              <p>Drafts, pick’em och privata ligor. Vi hjälper operatörer och mediebolag att göra sportintresse till gemensamma upplevelser.</p>
              <ArrowUpRight className="about-row-arrow" aria-hidden="true" />
            </a>
            <a className="about-product-row" href="https://scoutgaminggroup.com/ai-casino" target="_blank" rel="noreferrer">
              <span className="about-product-number">02</span>
              <div><span className="about-kicker">NÄSTA KAPITEL · UNDER UTVECKLING</span><h3>AI live casino<span className="about-product-mark" aria-hidden="true">♧</span></h3></div>
              <p>Vi utforskar ett nytt slags spelbord med digitala värdar och lokala språk. Möt Astrid i vår blackjackpilot.</p>
              <ArrowUpRight className="about-row-arrow" aria-hidden="true" />
            </a>
            <Link className="about-pilot-link" href="/lobby">Nyfiken på Astrid? Besök blackjackpiloten <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </section>

        <section className="about-offices about-container" aria-labelledby="offices-title">
          <div className="about-section-label"><span>03 / HÄR FINNS VI</span><span>OLIKA PLATSER. SAMMA SCOUT.</span></div>
          <div className="about-offices-heading"><h2 id="offices-title">Tre adresser.<br /><em>Ett team.</em></h2><p>Idéer reser bra.<br />Våra går mellan Stockholm,<br />Malta och Lviv.</p></div>
          <div className="about-office-grid">
            {offices.map((office) => (
              <article className="about-office" key={office.city}>
                <div className="about-office-top"><span>{office.number} / {office.region}</span><span className="about-office-dot" aria-hidden="true" /></div>
                <h3>{office.city}</h3><p>{office.focus}</p><span className="about-coordinates">{office.coordinates}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="about-hello about-container" aria-labelledby="hello-title">
          <span className="about-kicker">DET BÄSTA BÖRJAR MED ETT SAMTAL</span>
          <a href="mailto:hello@scoutgaminggroup.com"><h2 id="hello-title">Ta plats.<br /><em>Säg hej.</em></h2><span className="about-hello-arrow"><ArrowUpRight aria-hidden="true" /></span></a>
          <p>hello@scoutgaminggroup.com</p>
        </section>
      </main>

      <footer className="about-footer about-container">
        <Link className="about-wordmark" href="/">scout<span>/</span>gaming</Link>
        <p>© {new Date().getFullYear()} Scout Gaming Group</p>
        <a href="https://scoutgaminggroup.com/about" target="_blank" rel="noreferrer">Företagsinformation & källa <ArrowUpRight size={14} aria-hidden="true" /></a>
      </footer>
    </div>
  )
}
