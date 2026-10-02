# Labbet följer Kevins källkontrakt

De 16 noderna är **labbets grupperingar över sex befintliga presentationstyper**:
`speak`, `deal`, `reveal`, `settle`, `turn`, `idle`. De är inte nya motor-events.
`sourceStatus: verified` betyder att källtyp och publicerade fält finns i
[presentationEvents](../web/partner-presentation.mjs), inte att en variant,
video eller produktintegration är godkänd. RNG, regler och utfall ändras inte.

Kontroll 2026-09-20: lokal `partner-presentation.mjs`, `shoe-game.mjs` och
`blackjack.mjs` hade samma Git-blobbar som den tillgängliga Kevin-revisionen
`626554d`. Det är ett daterat källkvitto, inte ett påstående om Kevins senaste
remote-head eller aktuell produktion. Före integration krävs ny avstämning.

## Vad testerna bevisar

[Kompatibilitetstestet](test/engine-compatibility.test.mjs) anropar den riktiga
presentationsfunktionen med syntetiska **publika vyer**. Det kontrollerar
eventordning, alla sju boxar, exakta talrader, hålkort/reveal och att ett
variantbeslut inte ändrar publicerade fakta. Modell, RNG, databaser och
videospelare används inte. Detta är inte ett fullständigt spel- eller videotest.

Kör från repots rot: `node --test lab/test/engine-compatibility.test.mjs`.
Testet ingår också i `npm --prefix lab test`.

- Sju riktiga boxar grupperas som vänster **0–1**, mitten **2–4**, höger **5–6**.
  Scenens tre riktningar är illustrationer, inte ett nytt treplatsbord.
- `settle` och efterföljande `speak` är separata events. Dealer-blackjack kan
  exempelvis ge labbgruppen `settle.push`, men talraden är ändå
  `dealerblackjack`. Blandad vinst/förlust kan ge `settle.win`.
- `settle.dealerBust` läser `dealerTotal > 21`; det är inte ett eget vinstbeslut.
  Talraden bestäms fortfarande av originalfunktionen, inklusive handresultaten.
- `speak.other` samlar flera exakta talrader. En labbvideokoppling där kan inte
  ersätta ett separat godkänt talpaket för varje riktig `line`.
- Projektionen behåller kort, mål, handindex, utfall och legal actions men
  utelämnar pengar och onödiga mediehintar. Dolt kort förblir `null`.

## Gränsen till riktiga videor

`generationId` med originalhash och `want/no` är **intake**. En bearbetad
`takeId` behöver egen action, mediehash, kalibrering och review. Cue-namnen
`pickup`, `release`, `land`, `rest` beskriver bildrutor, inte spel-events.
Labbets originalpreview och rörelsesekvenser godkänner inga takes.

Labbvalideringen hindrar fel delningsriktning och ersatt kortvändning i dess
syntetiska animationer. Det intygar inte att en rå video har rätt innehåll.
Nästa Kevin-granskade adapter behöver binda **exakt dealer + action/mål eller
speech-line + godkänd take**, med text/ljud, hash, landning, status och befintlig
fallback. Den vanliga spelklientens anslutningspunkt återstår att fastställa;
Partner-API:ets `presentation[]` är inte redan inkopplat i den klienten.

Se [V3:s historiska kontrakt och beslutsgräns](https://github.com/Jakeminator123/github-work/blob/Jakobs-v1/docs/animation-events/v3-9-days-mvp/s03-eventtradet.md)
och [videoregistrets nivåer](../docs/LOCAL-PRESENTATION-RUNTIME.md).
