# Croupier frontend

## Aktuell källa och drift

Den här katalogen är Vercel-projektet `croupier-frontend` i
[Jakeminator123/github-work](https://github.com/Jakeminator123/github-work),
branch `main`. [Startsida](https://www.scoutgaming.tech/),
[spel](https://www.scoutgaming.tech/game) och
[Croupier Studio](https://www.scoutgaming.tech/studio) har samma publika origin.
Studio byggs i ett separat Vercel-projekt; Render äger auktoritativ spelmotor
och live-transport. Se [driftkartan](../../docs/CLOUD-MIGRATION.md) och
[senaste verifierade leverans](../../docs/JOHN-HANDOFF.md) för produktion och QA.

Med `CROUPIER_VERCEL_UI=1` använder frontend de incheckade route-/ingress-
kontrakten och paketerade produktgränssnitten. `/lab`, `/labb` och äldre
Studio-adresser omdirigerar till `/studio`; video-, zon- och guidegenvägar
behåller sina undersidor. Utan flaggan används de äldre Render-genvägarna och
`CROUPIER_GAME_URL`. Den grenen behövs ännu och är inte en isolerad QA-konfiguration.
`/demo` länkar till det serverägda spelet. Den oanvända klientbaserade
blackjack-demon, dubbla CSS-filen och oanvända UI-/tema-/hookkomponenter är borttagna.
Den aktiva Button-komponenten och landningssidans kortsymboler är kvar.

Native Studio/Neon och nya speladresser provas i en separat QA-miljö.
Produktion använder ännu äldre BO-/Studio-grenar tills full AI/GPU-acceptans
och det samordnade källbytet är verifierade. `/blackjack` är idag spelarentré,
`/game` spelet; målbilden är `/player-login` respektive `/blackjack`.

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

Preview är inte automatiskt isolerad från produktion. Använd bara rätt QA-
backend, separat databas och hostname för syntetiskt spelprov; följ driftkartan.
Ta inte bort lagringsprojektet `croupier-player-preview-qa` som en dubblett.

Importproveniens: katalogen kom från `Jakeminator123/croupier-frontend`,
`main` på `2ec2b3f2f7ea11c57f703f58a8fecdb540e5649c`, 29 september 2026.
Den fristående källan och äldre v0/Vercel-projekt är avvecklade.
