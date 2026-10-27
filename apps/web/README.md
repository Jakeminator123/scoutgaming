# Webbfrontend (`apps/web`)

Tjänsten `web` i Vercel-projektet `scoutgaming`. Den bygger startsidan,
spelarens sidor och ingressen till spelmotorn och Studio-tjänsten på samma
publika origin, [www.scoutgaming.tech](https://www.scoutgaming.tech/). Tjänsten
`studio` (`apps/studio`) serverar `/admin`, `/partner` och `/lobby`; spelmotorn
kör på Render `croupier-v3`. Läget står i [överlämningen](../../docs/NEXT-AGENT.md)
och driften i [CLOUD-MIGRATION](../../docs/CLOUD-MIGRATION.md).

## Adresser

- Spelstarten är `/game?game=blackjack|roulette&operator=…&table=…`.
  Blackjack proxas från spelmotorn efter sessionskontrollen i
  `lib/server-ui.mjs`. Ett roulettrum skickas (307) till spelmotorns dokument
  `/play/roulette?operator=&table=`, eftersom roulettklienten skickar sidans
  query som rumskontext. `/game` utan spelkontext leder till `/lobby`.
- `/play/blackjack`, `/blackjack` och `/roulette` är 308 till `/game` under en
  release. `/player-login` är spelarens inloggning; `/play/profil` och
  `/play/historik` är spelarens sidor.
- `/lab`, `/labb` och äldre Studio-adresser går till `/admin`; `/bo`, `/v2`,
  `/demo` och `/casino.html` är borta.
- Partnerinloggningen är `/partner/login` med separat `partner_session`.

`CROUPIER_VERCEL_UI=1` och `CROUPIER_VERCEL_UNIFIED_UI=1` styr de incheckade
route- och ingresskontrakten; utan dem finns ingen spelstart.

## Delade kontrakt

- `packages/navigation` äger dokumentadresser, bolagssluggar och
  bolagsentrén; `server/platform-routing.mjs` delas av frontend, Studio och
  Render-ingressen, och `game-entry.mjs` äger speladresserna.
  HTML-delen ligger i `services/game/public/game-entry-contract.mjs`.
- `packages/player-catalog` äger de publika katalogladdarna.
- `packages/server-transport` delas med talservicen `apps/speech` (socketvägar,
  reläkärna och Node-servern med `ws`).

Frontend importerar dessa direkt, utan Studios privata routekod eller
spelmotorns SQL-moduler. HTTP, sessioner och behörighet förblir appägda.

## Startsidans intro

Startsidan och spelknapparna renderas direkt. Datorintrot laddas efter
hydration och spelas en gång per sidladdning; mobil och surfplatta laddar
varken introfilmer eller desktopeffekter. Reduced motion, dold sida, Skip och
Escape, mediefel och watchdog lämnar sidan användbar.

## Bygga och prova

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

`npm test` kör SSR-, routing-, inloggnings- och uppspelningsprov; bygget kör
dem före `next build`. Typkontrollen krävs separat eftersom Next-konfigurationen
hoppar över byggets typfel. Integrationsproven mot talservicen och spelmotorn är
`test/platform-native-websocket.mjs` och `test/platform-moving-speech.mjs` i
reporoten. Talservicen använder Node 22 och egen lockfil: kör
`npm ci --ignore-scripts` i `apps/speech`.

`node_modules/`, `.next/`, `runtime-ui/` och spelresurserna som
`tools/prepare-platform-ui.mjs` skriver i `public/` genereras och är
Git-ignorerade. Ändra spelkällan i `services/game/public` och den delade
presentationen i `packages/presentation`.

Preview är inte automatiskt isolerad från produktion. Syntetiska spelprov körs
i staging med egen databas och hostname.
