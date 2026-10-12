# Enkel Vercel-ingång till Blackjack

Vercel bygger en statisk startsida med knappen **Blackjack**. Knappen leder
till `/blackjack` på den beständiga spelservern. Inloggning och cookies stannar
på spelserverns origin; lyckad inloggning öppnar
`/?dealer=astrid&presentation=local`, samma presentation som Lissabon.

När spelarkonton aktiveras används de i stället för Lissabons lösenordsfria
namnprofiler. Gamla profiler och databaser bevaras; de migreras inte automatiskt.

## Konfiguration

| Placering | Variabel/val | Värde |
| --- | --- | --- |
| Vercel-projekt | Root Directory | `ops/vercel-entry` |
| Vercel-projekt | Include source files outside Root Directory | På (delad CSS i `web/public`) |
| Vercel build | `CROUPIER_GAME_ORIGIN` | Tomt tills exakt HTTPS-origin beslutats |
| Spelserver Web | `CROUPIER_PLAYER_ACCOUNTS` | `1` aktiverar separat inloggning/registrering för spelare |
| Spelserver | `CROUPIER_DATA_DIR` | Beständig tom datakatalog utanför checkout |
| Spelserver/Lab | `LAB_VIDEO_ARCHIVE` | Samma verifierade Lissabon-mediebank |
| Spelserver/Lab | `CROUPIER_STREAM_LANE` | `lissabon-stream-lane` |

Molnstartaren för vidare `CROUPIER_PLAYER_ACCOUNTS` endast till Web. Flaggan
är av som standard. `ops/cloud` har kvar sin verifieringsspärr. Övriga krav
på origins, Lab, beständig lagring och operatörsbootstrap finns i dess README.
En publicerad startsida innebär inte att backend är driftsatt eller godkänd.

Spelarkonton använder befintliga `player_accounts` och `player_sessions` i
SQLite: användarnamnet får ett eget `username:`-namnrymdsprefix, lösenordet
hashas med scrypt och identiteten får ett servergenererat spelar-id. Scout-
konton kan fortfarande logga in via sin befintliga väg. Registrering skapar
inga CRAIG-operatörer eller BO-roller. Sessioner slutar gälla när kontot tas
bort eller lösenordshashen ändras. Åtkomst nekas medan funktionen är avstängd.

Lokal utveckling kan bygga med `--local` och en uttrycklig loopback-origin.
Vanligt bygge avvisar localhost. Ingen dev-server ingår i Vercel-bygget.
Använd samma samordnade produktstart som tidigare; starta inte ett andra par.
Ingen riktig databas eller privat `.env` ska kopieras till Vercel eller tester.

## Återstår före publik drift

- Besluta exakt Vercel-projekt och spelserverns HTTPS-origin/beständiga värd.
- Prova inloggning, registrering, utloggning och samma spelar-id efter omstart
  med tom testdatabas. Prova därefter i verklig browser och på mobil.
- Nuvarande inloggningsgräns för nya spelarkonton använder anslutningens IP,
  inte en osäker klientskickad forwarding-header. En ensam proxy samlar därför
  försöken i en hink (12/10 minuter). Verifiera betrodd klient-IP från den
  valda hostingkedjan före fleranvändardrift.
- Återställning av glömt lösenord och kontoåterhämtning saknas.
- Kortprojektionen från Kevin-granskningen är ännu inte importerad; se
  `docs/KEVIN-LISSABON-REVIEW.md`.

Ingen tjänst eller deployment har skapats av dessa filer.

## Opt-in förhandsbygge: frontend på Vercel

Bygglogiken ligger i `apps/croupier-frontend/tools/player-ui-build.mjs`.
Vercels historiska `buildCommand` i den här katalogens `vercel.json` är
fortfarande strängen `node build.mjs` och hittar inte längre en fil här.
Projektet är inte publicerat.

Standardanropet utan flaggor skriver `dist/` bredvid skriptet: bara
landningssidan och dess CSS, och knappen leder fortsatt till spelserverns
`/blackjack`. Detta är **inte** en produktions-cutover.

För ett separat lokalt eller Vercel Preview-bygge kan kommandot uttryckligen
sättas till `node apps/croupier-frontend/tools/player-ui-build.mjs --frontend-preview`
(med samma `CROUPIER_GAME_ORIGIN`); lokalt mot loopback:
`node apps/croupier-frontend/tools/player-ui-build.mjs --local --frontend-preview`.
Använd en ren `dist/` före ett
sådant separat bygge, eftersom skriptet inte rensar gamla filer. Kontrollera
med `node --test test/build-preview.mjs` från denna katalog. Flaggan lägger
till `/frontend-preview/blackjack/` och `/frontend-preview/game/` i `dist`,
med interna Vercel-URL:er för inloggning→spel. Endast dessa två HTML-sidor,
deras textbaserade JS/CSS-modulberoenden och små JSON-beroenden kopieras;
inga spelvideor, bilder, BO- eller Lab-sidor kopieras. Förhandslägets CSP gäller
bara `/frontend-preview/`; övriga vägar behåller tidigare CSP. Denna
uppdelning använder Vercels [dokumenterade negativa lookahead för
`source`](https://vercel.com/docs/project-configuration/vercel-json#negative-lookahead).

Sidorna kan alltså **levereras statiskt från Vercel**, men är ännu inte ett
fungerande spel. Mediefilerna saknas avsiktligt och `/api/*` har inga
Vercel→Render-rewrites. För nästa, separat fas behövs en exakt ruttkarta och
verifierad proxy för auth, spel, presentation, medieförfrågningar inklusive
Range/206, BO/Lab, SSE och WebSocket. Backenden avvisar idag POST om
webbläsarens `Origin` inte matchar Render-värdens `Host`; en enkel extern
rewrite från Vercel ger därför 403 utan en avgränsad serverändring. Direkt
cross-origin-anrop löser inte det, eftersom player-sessionen använder
`SameSite=Strict` och CORS saknas. Talströmmen använder också WebSocket på
`location.origin`, och långlivad SSE/WebSocket via Vercel är ännu inte
verifierad. Lägg inte till bred `/api/*`-proxy, publicera inte BO/Lab som
statiska filer och flytta inte DNS/Production-länken förrän detta har testats
med isolerad backend och riktiga browserflöden.

En separat [Preview-projektrot](preview/README.md) innehåller den snäva
rewrite-kartan för ett framtida isolerat CLI-prov. Den påverkar inte detta
projekts `vercel.json` eller standardbygge.
