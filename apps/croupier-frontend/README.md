# Croupier frontend

## Aktuell källa och drift

Den här katalogen är service `web` i Vercel-projektet `scoutgaming`, från
[Jakeminator123/scoutgaming](https://github.com/Jakeminator123/scoutgaming),
branch `main`. [Startsida](https://www.scoutgaming.tech/),
[administration](https://www.scoutgaming.tech/admin),
[lobby](https://www.scoutgaming.tech/lobby) och spel har samma publika origin.
Service `web` bygger startsidan, befintliga spelarvyer och spelklientens ingress.
Service `studio` byggs från `lab` och serverar `/admin`, `/lobby`, `/control`
och `/partner`. `/studio` är dess tekniska basePath. Båda tjänsterna ligger
i Frankfurt. Render äger auktoritativ spelmotor och live-transport.
Det äldre frontendprojektet är en domänlös reserv med Git-byggen avstängda.
Se [driftkartan](../../docs/CLOUD-MIGRATION.md) och
[senaste verifierade leverans](../../docs/JOHN-HANDOFF.md) för produktion och QA.

Med `CROUPIER_VERCEL_UI=1` använder frontend de incheckade route-/ingress-
kontrakten och paketerade produktgränssnitten. `/lab`, `/labb` och äldre
Studio-adresser omdirigerar till `/control`; video-, zon- och guidegenvägar
behåller sina undersidor. Utan flaggan används de äldre Render-genvägarna och
`CROUPIER_GAME_URL`. Den grenen behövs ännu och är inte en isolerad QA-konfiguration.
`/demo` länkar till det serverägda spelet. Den oanvända klientbaserade
blackjack-demon, dubbla CSS-filen och oanvända UI-/tema-/hookkomponenter är borttagna.
Den aktiva Button-komponenten och landningssidans kortsymboler är kvar.

Fortsatt UI-utveckling sker i `/admin` och `/lobby`. Övergången är inte klar:
`/control`, `/partner` och `/play` behåller fungerande inloggning, verktyg och
spelstarter. `/admin` kräver intern N1-inloggning; `/lobby` läser publika bolag
och spelbara rum. Deras UI-källa finns i `lab/client`.

Native Studio/Neon och gemensam policy är aktiva i produktion. `/player-login`
är spelarentré. I unified/native-läget startar ett uttryckligt rum/dealerval
spelet via `/play/blackjack`; en allmän blackjackadress leder till `/play`.
Äldre `/game`- och `/blackjack`-länkar hanteras av det delade entrékontraktet.
`CROUPIER_VERCEL_UNIFIED_UI=1` styr den gemensamma Services-konfigurationen.
Partnerinloggning finns på `/partner/login` med separat `partner_session` och
scoped medlemskap; intern admin kan också använda portalen. Den befintliga
spellobbyn, profilen och historiken finns under `/play`. T2–T4 har kvarvarande
acceptans- och integrationspunkter i driftkartan; de betyder inte att dessa
funktioner saknas. Separata QA-miljöer bevaras för syntetiska prov;
full AI/GPU-acceptans redovisas separat.

## Landningssidans uppspelning

Startsida och spelknappar renderas direkt. Datorintrot laddas efter hydration
och spelas en gång per full sidladdning. Mobil och surfplatta importerar varken
introfilmer eller de extra desktopeffekterna. Reduced motion, dold sida,
history-navigation och ändrad enhetskapacitet lämnar sidan användbar.
Skip/Escape, mediefel och watchdog frigör intro; teardown släpper video/WebGL.
Originalmedier och den delade fyrdealerspelaren ändras inte av frontendstädningen.

## Lokal verifiering och QA

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

`npm test` kör SSR-, routing-, autentiserings- och uppspelningsregressioner.
Bygget kör testerna före `next build`; separat typkontroll krävs eftersom
Next-konfigurationen tills vidare hoppar över byggens typfel.
Interaktiva produkt-/labbprov använder den gemensamma sessionsvakten.

`node_modules/`, `.next/`, `runtime-ui/` och de spelresurser som
`tools/prepare-platform-ui.mjs` skriver i `public/` genereras vid installation
eller bygge och är Git-ignorerade. De är inga egna produkter eller källarkiv.
Ändra spelkällan i `web/public` och den delade presentationen i
`packages/presentation`; förberedelsen kopierar dem till frontendbygget.

Preview är inte automatiskt isolerad från produktion. Använd bara rätt QA-
backend, separat databas och hostname för syntetiskt spelprov; följ driftkartan.
Ta inte bort lagringsprojektet `croupier-player-preview-qa` som en dubblett.

Importproveniens: katalogen kom från `Jakeminator123/croupier-frontend`,
`main` på `2ec2b3f2f7ea11c57f703f58a8fecdb540e5649c`, 29 september 2026.
Den fristående källan och äldre v0/Vercel-projekt är avvecklade.
