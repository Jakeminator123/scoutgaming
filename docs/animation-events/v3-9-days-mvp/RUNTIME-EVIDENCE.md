# Verifierad runtime-evidens

> **Verifierat i Croupier** mot `origin/codex/restore-casino-environment` på commit `eaffbb850d24cc6c6881cab83acbdac19e2609bb`, hämtad 19 september 2026. Detta är ett revisionsankare, inte ett löfte om att branchen aldrig ändras.

## Speloperation och publicerad vy

`web/shoe-game.mjs` visar:

- externa operationer `start`, `act`, `insurance` och `collect`;
- faserna `dealing`, `insurance`, `decisions`, `dealer` och `settled`;
- publicerad rundvy med `boxes`, `hands`, `dealer`, `phase`, `active`, `holeDraw` och `legalActions`;
- `shoeDraw` på utdelade kort;
- en uttrycklig säkerhetsgräns: shoe-ordning, burn, privat hole card och interna eventpayloads skickas inte i vyn.

## Interna blackjack-events

`web/public/blackjack.mjs` har en intern `events`-lista och emitterar på den verifierade revisionen:

| Event | När |
| --- | --- |
| `round.dealt` | Den initiala utdelningen är gjord. |
| `insurance.offered` | Dealerns uppkort är ess och försäkringsfas öppnas. |
| `dealer.peek` | Dealer kontrollerar möjlig blackjack. |
| `dealer.blackjack` | Peek visar blackjack. |
| `hand.thinking` | En spelarhand är aktiv för beslut. |
| `card.dealt` | Ett kort ges till aktiv hand, även efter double/split. |
| `hand.split` | En hand delas. |
| `dealer.reveal` | Hålkortet visas inför dealerfas. |
| `dealer.draw` | Dealer tar ytterligare kort. |
| `round.settled` | Resultat och utbetalningar är beräknade. |

Eventnamnen ovan är runtimefakta på den angivna revisionen. De betyder inte automatiskt att varje event publiceras oförändrat genom partner-API:t.

## Presentationshändelser

`web/partner-presentation.mjs` härleder en ordnad presentationslista från föregående och ny publicerad rundvy. Följande `type`-värden är verifierade:

- `speak`
- `deal`
- `reveal`
- `settle`
- `turn`
- `idle`

Viktiga verifierade gränser:

- Presentationen beskrivs uttryckligen som **hur** ett serveravgjort event visas; servern avgör spelet.
- Kort identifieras och ordnas med `shoeDraw`.
- Hålkortet ger `reveal`, inte en andra `deal`.
- Deal väljer action `deal-left`, `deal-centre`, `deal-right` eller `deal-dealer` utifrån box.
- En deal har exakt preferens och fallback `slide`.
- Settle härleder talraden `dealerblackjack`, `blackjack`, `dealerbust`, `win`, `push` eller `lose` från publicerat rundresultat.

## Media och landning

Samma fil bygger assetmanifest från bland annat:

- dealeridentitet;
- streamindex;
- `performance/manifest.json`;
- take-id, action, media, fps och frames;
- take-events samt beräknad `landAtMs` från eventets land-frame;
- speech-bank med line, text, audio, lipsync-delay och exakt clip-id när det finns.

Detta gör Croupiers nuvarande presentationsmodul och manifest till den naturliga roten för V3:s event–videomappning.

## Video-API

`web/generations-api.mjs` verifierar ett separat read-only-API:

- `GET /api/v1/generations`
- `GET /api/v1/generations/:id/video`

Listningen exponerar metadata som id, prompt, model, verdict, landedAt, size, sha256 och downloadUrl. API:t ändrar inget och använder serveruppslagning av id i stället för klientstyrda filsökvägar.

## Fortsatt verifiering

Innan M1 markeras grön ska Jakob:

1. notera aktuell Kevin-commit på nytt;
2. kontrollera om eventlistan eller presentationsmodulen ändrats;
3. skilja interna events från partnerpublicerade payloads;
4. länka varje aktiv nod i s03 till fil/symbol och revision;
5. märka alla andra noder **Jakobs förslag**.
