# Masterplan: nivå 1 blir dealer → lager → lane

Skriven 8 okt 2026 av t10-trelager efter live-`/control` + kod.
Ingång: `random/start-T10-2026-10-08.md`. Bakgrund: `random/handoff-T10-trelager-standard-2026-10-08.md` (`330aec38`).
Ersätter T10-handoffens mål `/control/layers` och `layered` som spelstandard ikväll.

## Syfte (Jakobs modell)

```
Admin-konto (klart)
    → Dealers (lägg till / ta bort)
        Idle · Deal · Probe · ev. ljudsignal
        bakgrund BAKOM · bord FRAMFÖR
        kalibrera i Förhandsvisning
        välj agerande (klipp utan bakgrund/bord)
    → Förhandsvisning = spelare + editor (mobil 9:16 / desktop 16:9)
    → Lane = paket av dealers + bakgrunder + bord (+ senare spel)
        → export till nivå 2
```

Blob: `croupier/media/backgrounds/…` (mp4 + bild) och `croupier/media/tables/…`.

## Poäng

| | /10 | Varför |
|---|---|---|
| Idé | 9 | Rätt objektgraf. Tre lager + lane-som-export är studion. |
| T10-handoffen | 4 | Lade till en femte bibliotekssida. Du vill ha färre steg. |
| Min förståelse | 8 | Flöde, överlapp och blob-lås är klara. Keying vs dölj-lager öppet. |
| 2-timmars-slice | 6 | Slim + blob-mappar + preview-koppling ryms. Inte dealer-CRUD + rendererbyte. |

## Vad som redan är sant

| Del | Status | Bevis |
|---|---|---|
| Studio-admin skapa → acceptera → logga in | klart i kod | `?tab=accounts` → `/control/set-password`. Bolag-kortet är partner, inte Studio-login |
| Exakt fyra dealers | låst | `studio-model.mjs` `dealers` 4–4, `DEALER_IDS` |
| Idle/Deal/Probe/tal | finns, utspritt | clips + videos + events + probe. Probe är policy, inte Blob-mapp |
| Trelager-UI | demo-iframe | Paow/Dragge, mobil/desktop i `preview/site`. `scene.show` finns, UI har inte lager av/på, ingen upload |
| Lane `layers.*` | i studioprojektet | Spelet läser `gameChoicesForLane` därifrån. `operator_packages` har bara lane-id + `games/tables/branding` |
| Nivå 2 | färg + branding | Bakgrund och dealer är tomma fält och sparas inte |
| Nivå 3 | localStorage | `croupier.choices.<slug>`, inte per konto. Bakgrund målas inte |
| Blob bakgrund/bord | nej | `NEW_PATH` bara `dealers/{4}\|game\|site`. `media_records` bara `video/mp4\|webm` |
| Zones styr spelet | nej (L16) | egen Neon, dealer låst till astrid. `web/` läser aldrig `.zones` |
| T9 | `?lane=layer-preview` | Cookie krävs för `/layer-packs` (annars 404). `lab/preview-build` gitignorerad; Render troligen utan |

## Överlapp att konsolidera (inte lägga till)

| Jobb idag | Ytor | Åtgärd |
|---|---|---|
| Dealer + klipp | clips + videos | Videos in i clips (upload + namnbyte måste följa). |
| Händelser | egen | **Inte folda.** Villkor och frekvens finns bara här. Dölj i meny, URL kvar. |
| Bakgrund | zones + preview + lane.layers | Blob-mapp + välj i preview + plocka i lane. Zones orörd (unik pixelruta). |
| Bord | lane.colors + partner + preview | Blob-fil, inte bara färg. `operator_packages.tables` är id-lista idag. |
| Lagerprov | preview iframe vs T9 | Preview blir editorn. Spelet byter renderer senare. |
| Två lane-lager | `project.lanes` vs admin `game-lanes/*` | **Inte slå ihop.** Olika dokument. Dölj `?tab=tables` i meny, rör inte datan. |
| Konton | `?tab=accounts` vs Bolag | Olika objekt (Studio-admin vs partner). Båda stannar. |
| Probe | egen sida | Policy stannar; klippen hör till dealern. |

Meny nu: 17 poster. Mål-Studio: Dealers, Förhandsvisning, Lanes. Resten Drift/Åtkomst eller dold med URL kvar.

## Etapper (orkestrering)

Parallellt där det går. Inget spelet-byte utan rehearsal.

| ID | Vad | När | Vem | Bevis |
|---|---|---|---|---|
| A0 | Kartläggning (denna fil + live) | klar | jag | poäng + denna plan |
| A1 | Slim: ta bort brödtext/breadcrumb på videos + clips. Inga borttagna handlingar. | parallell | grok-4.7 | skärmbild videos: rutnät först, 0 hjälpstycken |
| A2 | Meny: dölj videos, zoner, events, `?tab=tables`. URL kvar. Inte slå ihop de två lane-lagren. | parallell med A1 | grok-4.7 | 17 → ~10 synliga; gamla URL:er lever |
| A3 | Blob-allowlist: `backgrounds/` + `tables/` + bild-MIME. `media_records` måste släppa bild (Studio-migration två steg). | efter ja | jag (fail-closed) | path + bild i test; Neon först om schema ändras |
| A4 | Preview: samma kompositor, riktiga dealers + blob-lager. Exponera `scene.show` (lager av/på). Mobil/desktop stannar. | efter A3 | Opus/jag | skärmbild Astrid + bakgrund + bord |
| A5 | Publicera bär innehåll, inte bara lane-id. Nivå 2 får fyllda bakgrund/dealer-fält inom lanen. | efter A3 | grok-4.7 | paket innehåller dealers + bg-id + bord-id |
| A6 | Dealer lägg till / ta bort | **inte ikväll** utan ditt ja | Opus | schema-cap 4 är medveten |
| A7 | `layered` som spelstandard / `mobile-phone` byte | **inte ikväll** | — | T9 först sedd + din rehearsal |
| A8 | Docs på plats (TERMINOLOGI, guide, AGENTS) | sist | grok-4.7 | 5-docs-regeln |

## Inte ikväll

- Ny sida `/control/layers` (T10 K3) — motsatsen till färre steg
- Keya Astrid (Emil T7)
- N2.4 spelare/transaktioner
- Spelarens val-migration 007
- Radera zones/events-kod (bara meny)

## Tveksamt — behöver ditt ord

1. Ingen ny `/control/layers` — folda in Dealers + Preview + Lanes. Ja?
2. Dölj (inte radera) Klippbibliotek / Zoner / Händelser / Bord & lanes i menyn, URL kvar. Events och zoner behåller unik handling. Ja?
3. Dealer-CRUD (fler än astrid/vera/amira/mei) ikväll, eller efter A4?
4. "Klipp utan bakgrund eller bord" = dölj lagren i preview, eller keyat overlay (Emil)?
5. Bord = egen Blob-fil (bild/video), inte bara `layers.table.colors`?
