# A06 · Kevin-branchen: integrationsunderlag

Läsande. Ingen helmerge. Ingen kod utanför denna fil. Svarsutkastet är inte skickat.

## Läst

| Ref | SHA | Ämne |
| --- | --- | --- |
| `kevin` (läst, inte utcheckad) | `204ddf87c77a628c9b67ec04f92b6fa49246f468` | dealer clips load 4 at a time and can come from a cache host (2026-10-12 11:47 +0200) |
| `main` | `919691072212c044ccaf5aeaa8f0b2fbf99b1bf5` | Pin Studio migration 008 after production apply (2026-10-12 11:54 +0200) |
| merge-base | `7714ec6cebc991a9ff7b7707552d82b54bac707d` | oförändrad mot planen |
| Förälder till spetsen | `eea5e40bfd75e61ab8f604b54d6c2f19ad0fb8f3` | Table Studio accepts the BO's new aggregator role |

`git rev-list --left-right --count main...kevin` → **96 / 115** (main har 96 som kevin saknar, kevin har 115 som main saknar). Planens 83 / 113 gällde äldre spetsar (se Avvikelse).

Tre-punktsdiff `main...kevin`: **1 341 filer, +45 492 / −330**. Av dem ligger 1 168 under `kevin/` (appen, 711 MiB). Övriga 173 är mest okt-8-banken i `media/dealers/{dragge,paow}` plus Studio-kontraktet.

`kevin/` importeras inte av mains appar, lanes eller tester (`kevin/README.md`). Live enligt samma README: https://croupier.scoutgg.dev, deploy vid push av `kevin/croupier-scoutgg/`.

## Steg 0

Angiven hämtning nekades, icke-snabbspolning:

- `git fetch origin kevin:refs/remotes/origin/kevin` → rejected (non-fast-forward)
- `git fetch origin main:refs/remotes/origin/main` → rejected (non-fast-forward)

Läst via `git fetch origin kevin:refs/a06/kevin main:refs/a06/main`. Den hämtningen uppdaterade också de lokala spårningsrefsen `origin/kevin` och `origin/main` (tvingad, bara lokalt, ingen push). Snapshotens `origin/kevin` `6630e908` är inte förfader till `204ddf87` (omskriven historik; samma ämne som `2718393f`).

Node: ingen 24. Skripten kördes med nvm **v22.23.3** (standard i VM:en är v22.14.0). Inga beroenden installerades. `kevin` checkades inte ut.

Systemkarta på integrations-HEAD `43bb429c`: gul, **0 röda**, 14 gula, 178 varningar (baslinje 165). Föräldralösa tester: 360 filer, 0 föräldralösa, 2 undantag (baslinje 359). Inget stoppvillkor. Ingen röd systemkarta. Aktiviteten tar inte bort filer.

## Funktionskarta

Jämförelsen är mot `main` `91969107`. "Saknas" betyder att main inte har funktionen. Ägarskapet i AGENTS.md står kvar: servern äger spelmotor, sko, saldo, utbetalningar och medieacceptans.

| Kevin-funktion | Motsvarighet på main | Läget |
| --- | --- | --- |
| Table Studio `/studio`: BO-login, ett bord (dealer, rum, filt, språk, gränser, logga), delning `/t/<slug>` som sätter besökaren direkt | `/studio` är lab-tjänstens `basePath` (N1 `/control`). Rum och utseende: `/control/rooms`, `/partner/{slug}/rooms`, `presentations.configure` (branding, bordsfärg, revision). Ingen `/t/<slug>` | Flödet saknas. Mains publicering är bättre för behörighet och revision. Namnkrock på `/studio` |
| Inloggning `GET /api/studio/session`, `POST /api/studio/login\|logout` | N1-session och `/partner/login`. Kevin relayar till en **extern** BO (`/api/bo/login`, `/api/bo/me`), inte till mains partnerkonton | Saknas som koppling. Annan identitet |
| `GET/POST /api/studio/table` | Partnerns rumsutkast och publicerade paket | Saknas som delningslänk. Mains paket är bättre som kontrakt |
| `GET /api/presentation?brand=` | Publicerat paket (`branding` + presentation) | Liknande idé, annat kontrakt. Mains är bättre (revision, tenant) |
| `POST /api/table` (state, start, act, insurance, collect) | `web/server.mjs` på Render | Mains motor är den som gäller. Kevins är en vendored kopia |
| `GET /api/internal/game-audit/integration` (Bearer) | Studio-journal och partnerjournal, inte detta API | Saknas. Granskningen sitter i en annan tjänst |
| KLARA-klipp Paow och Dragge: vila, redo, löpvarianter, hålkort, filmad vändning | Registrerade dealers: Astrid, Amira, Vera, Mei. Paow/Dragge finns bara som layer-preview (`web/public/game-lanes.mjs`, 11,64 MiB hashade filer i `test-videoeditor/preview/site/media`) | KLARA-spåret saknas i mains register. Layer-preview är ett annat, mindre underlag |
| Läppsynk −16 LUFS och livechatt (RunPod, Cartesia, granskat svar) | Inspelade talset på den gemensamma spelaren. Produktchatt: OpenClaw, stängd allowlist | Mains acceptans är striktare. Kevins generator är en andra talväg |
| Operatörslogga i topp och på filt | `branding.logo` på paketet. Prototypen `lab/components/kevin-bo/original-views.jsx` har filtposition; den mappen är partnerportalen och har inget med `kevin/` att göra | Beteendet på det riktiga bordet saknas. Prototypen är inte Kevins app |
| Backoffice `/bo` | Pensionerat alias. Operatör: `/partner`. Kevins server svarar 410 på `/api/backoffice/*` och pekar på https://croupier.scoutgg.dev/bo/ | Koden finns inte i branchen. Namnkrock om aliaset väcks |
| Mårten (KLARA, text, ingen röst) | Ingen dealer, inget media | Saknas. Stod inte i inkorg #10 |
| Klipp 4 i taget + `MEDIA_BASE_URL` (`204ddf87`) | Blob/runtime i spelmotorns image | Drift för scoutgg, inte ett main-kontrakt |
| Aggregator-roll (`eea5e40b`) | Mains roller är andra | En rad i `bo-session.mjs`: `aggregator` får bygga demobord. BO:n själv ligger utanför repot |

## Motor och saldo

`kevin/croupier-scoutgg/vendor/croupier/` är oförändrade filer från `scout-gg/croupier` **`3c2b70b`**, med en lokal ändring: `start` tar bordsgränser från Table Studio. `server/table-service.mjs` lagrar sko och **demolånbok** (start 1 000) i SQLite. Kommentarerna säger att produktionens plånbok inte öppnas. Det är ändå en andra motor. Den ska inte ersätta `web/server.mjs` och inte kopplas till spel-Neon.

Vändningen: `server/shared-table.mjs` lägger första `reveal` 1 500 ms senare än ett vanligt drag (700 ms). Det är inkorgens "1,5 s".

## Kandidater

Ingen kandidat ska in i städningen. B14 är öppen. Rekommendation: egen plan, selektivt, efter beslut.

| Kandidat | Var | Storlek | Beroende | Krock med main | Risk |
| --- | --- | --- | --- | --- | --- |
| KLARA-klipp som lever (vila/redo, hål, vändning, varianter `i/u/iu`, WebGL-key) | `public/media/dealers/{dragge,paow,marten}/v2`, `dealer-layer.js`, `dealers.js`, `meta.json` | Dragge 84,7 MiB v2 + 44,2 MiB green; Paow 84,7; Mårten 80,8. Hela dealerträdet 269 + 192 + 86 MiB | Kevins egen spelare, inte mains kompositor. Byggskript ligger utanför repot (`croupier-dealer-dragge/`, enligt `kevin/README.md`) | Layer-preview är andra filer. Nytt tal/video kräver rehearsal och invaliderar gammal visuell acceptans | Hög om den blir spelväg. Medel som senare, separat import |
| Okt-8-banken i det delade trädet | `media/dealers/{dragge,paow}/runtime/presentation` + staging + provenance | 66,4 MiB (Dragge 47,7 presentation, Paow 15,3, staging 3,5) | `studio-contract.json`, `layout.json` (+1 481 rader), `video-registry.mjs` | 30 filer är ändrade på båda sidor sedan merge-base, bland dem `web/server.mjs`, `web/public/app.mjs`, `AGENTS.md`. Paows bank saknar hålkort och tal som appen har | Hög. Banken är äldre än appen |
| Talbank i appen | `public/media/dealers/{dragge,paow}/repliker/{sv,en}` | 108 + 102 MiB, 264 mp4 | Egen URL-mappning (`dealerLineUrl`). Mårten har `lines: null` | Mains tal är kalibrerade set för fyra dealers. Paow var "utan tal" i okt-8-patchen av AGENTS.md | Hög. Inte accepterat på mains spelare |
| Läppsynkrecept | README: −16 LUFS, 1080×1920, 24 fps, H.264. **crf 13 finns inte i branchen** | text | Byggskript utanför Git. I repot finns ett gammalt Astrid-omkodat spår crf 12 mot crf 20 (`media_omkodad_crf20_2026-09-25`) | Ingen, om det bara antecknas | Låg som notis. crf 13 är obekräftat |
| Live-läppsynk | `server/pod-lipsync.mjs`, `dragge-voice.mjs`, `dealer-chat.mjs` | kod under 1 MiB | RunPod, Cartesia, Gemini, nycklar | OpenClaw äger produktchatten. Ny video-hash är inte godkänd mun | Hög. Ägarskap |
| Filtlogga | `public/felt-logo.js`, `studio-tables.mjs` (`logoPos`: both / felt / header, data-URL) | liten | Table Studio | Route `/studio`. Main har paket-logo, inte denna ritning på spelbordet | Medel som beteende |
| Table Studio-flödet | `public/studio/`, `server/studio-tables.mjs`, `server/bo-session.mjs` | liten | Extern BO och aggregator-rollen | `/studio` | Hög som route. Medel som idé för en delningslänk under `/partner` |
| Spelmotor, sko, demolånbok | `vendor/croupier/*`, `server/table-service.mjs` | liten | SQLite, gästcookie | `web/server.mjs` | Ta inte |
| `/bo` | redirect, ingen BO-kod | — | https://croupier.scoutgg.dev/bo/ | Pensionerat alias | Ta inte |
| Okt-8-patchen som släpper in Dragge/Paow i chatt och kontrakt | `web/server.mjs` (CHAT_DEALERS), `web/player-chat-memory.mjs`, `lab/policies/studio-contract.json`, AGENTS.md "sex dealers" | +879 / −75 rader mot merge-base på 30 överlappande filer | Kräver att tal och klipp redan är accepterade | Samma filer har rört sig på main (t.ex. `app.mjs` 1 182 rader i två-punktsdiff) | Ta inte som cherry-pick |

## Media

Appen (`kevin/croupier-scoutgg`, 1 168 filer, **711 MiB**):

| Del | MiB | Filer |
| --- | ---: | ---: |
| `public/media` | 667,6 | 802 |
| `review/` (skärmdumpar) | 26,4 | 149 |
| `public/` utom media (mest korträckor) | 16,1 | 93 |
| `server/` | 0,19 | 33 |
| `test/` | 0,18 | 43 |

Dealers i appens `public/media/dealers` (blobstorlek):

| Dealer | MiB | Filer | Tal | Hål / vändning |
| --- | ---: | ---: | --- | --- |
| Dragge (Dragan) | 268,9 | 214 | 66 sv + 66 en | ja, i `v2/` och i `green/` |
| Paow | 192,5 | 194 | 66 sv + 66 en | ja i `v2/` (kommentar 9 okt). Saknas i okt-8-banken |
| Mårten | 86,4 | 62 | inget (`lines: null`, text) | ja i `v2/` |
| rum + rum-v2 + ansikten | 13,7 | 20 | — | — |

264 mp4 = Dragge 132 + Paow 132 = 66 repliker × 2 språk × 2 dealers. Det är inkorgens "264 repliker". Unika svenska id:n per dealer är 66, inte 264.

`v2/meta.json` har `frames`, `land`, `restStart`, `restEnd`, `card` för alla tre. Green-screen-plattor som egen mapp finns bara för Dragge (10 filer, 44,2 MiB). Keyingen ligger i `public/dealer-layer.js` (WebGL, händer över korten).

Main har **inte** `media/dealers/{dragge,paow,marten}`. Registrerade kataloger: `amira`, `astrid`, `mei`, `vera`. Studio-kontraktets dealers är de fyra. Paow och Dragge är namn i layer-preview-lanen, med 29 hashade filer (11,64 MiB) under `test-videoeditor/preview/site/media`. Det är inte KLARA-banken.

Okt-8-filerna på kevin, utanför appen, är ett andra och äldre exemplar: Dragges presentation har 51 tal-mp4 i en annan mappstruktur och hålkort; Paows presentation har utdelning och `rest.png` men varken talmapp eller hålkort (`klara-delivery.md`: hålet saknas). Appen har gått vidare efter det. `kevin/README.md` är också kvar på 8 oktober (Paow "text chat only", ingen Mårten, ingen Table Studio).

## Svarsutkast till inkorg #10

Inte skickat.

> Hej Kevin. Vi mergar inte hela `kevin` in i `main`. Jag läste `204ddf87` mot `main` `91969107` (gemensam bas `7714ec6c`): 115 commits före och 96 efter. Appen i `kevin/croupier-scoutgg` har egen sko och en demolånbok i SQLite. Spelmotorn, saldot och medieacceptansen stannar på main.
>
> Värt en egen plan: KLARA-klippen för Dragge och Paow (vila, redo, hålkort, filmad vändning) och loggan på filten. `/studio` och `/bo` krockar med namn vi redan använder. `/studio` är Studios basväg, `/bo` är pensionerat, och operatörsytan är `/partner`.
>
> Inkorgens merge `0a1279a` ligger inte på spetsen. Samma meddelande och tid finns som `3937eca4`. Paow har nu tal på svenska och engelska, och Mårten finns som textdealer. Det stod inte i #10. crf 13 syns inte i branchen. Säg om Table Studio-flödet eller KLARA-klippen ska vara först.

## Prov

| Kommando | Resultat |
| --- | --- |
| `git rev-list --left-right --count refs/a06/main...refs/a06/kevin` | `96	115` |
| `git diff --shortstat refs/a06/main...refs/a06/kevin` | 1341 files, +45492 / −330 |
| `git merge-base` | `7714ec6c` |
| `node docs/system-map/verify.mjs --check` (HEAD `43bb429c`, Node 22.23.3) | exit 0, gul, 0 röda, 14 gula, 178 varningar |
| `node tools/check-orphan-tests.mjs` | 360 filer, 0 föräldralösa, 2 undantag |
| Kevins `node --test` | kördes inte. Appen checkades inte ut och beroenden installerades inte |

## Avvikelse mot baslinjen

Baslinjens frysta main är `00ea55c5`. Planens senaste kända kevin är `eea5e40b`.

| Mått | Baslinje | Nu | SHA |
| --- | --- | --- | --- |
| main | `00ea55c5`, §6 till `e160af12` | `91969107` | två commits efter `e160af12`: `12a12fd6` Node 24-pin, `91969107` migration 008 pin. 13 commits efter `00ea55c5` |
| kevin unika / main unika | 113 / 83 | 115 / 96 | räknat på `204ddf87`…`91969107` |
| kevin-spets | `eea5e40b` | `204ddf87` | en commit: förladdning 4 klipp och cache-värd |
| merge-base | `7714ec6c` | samma | — |
| systemkarta | 0 röda, 14 gula, 165 varningar | 0 röda, 14 gula, 178 varningar | på `43bb429c`, inte infört av A06 |
| tester | 359, 0 föräldralösa | 360, 0 föräldralösa | samma |

`0a1279a` (inkorg #10, "Merge main into kevin") finns som objekt men är **inte** förfader till `204ddf87`. Motsvarande commit på den lästa historiken är `3937eca4` (samma ämne och tid, 2026-10-09 22:13 +0200).

## Dokumentändringar som behövs

Inga i denna aktivitet. `docs/` rörs inte.

Om B14 senare blir en selektiv import: AGENTS.md (fyra dealers, rehearsal), `docs/JOHN-HANDOFF.md`, `docs/LOCAL-PRESENTATION-RUNTIME.md` och `lab/docs/README.md` behöver beskriva vilka dealers som faktiskt accepterats. Det hör till A17, efter beslut. Okt-8-texten på kevin som säger att Paow saknar tal stämmer inte med appen.

`kevin/README.md` på kevin-branchen är inaktuell. Den filen är inte vår.

Baslinjens branchrad (113/83, spets `eea5e40b`) behöver uppdateras av orkestratorn. Inte här.

## Kvar

- B14 är öppet. Ingen import gjordes.
- Utkastet till #10 är inte skickat.
- Visuell jämförelse av klipp och rehearsal är inte gjord.

## Tveksamt

- Helmerge, eller cherry-pick av okt-8-patchen, skulle släppa in Dragge och Paow i produktchatten och Studio-kontraktet innan medieacceptans. Det ändrar ägarskapet för tal och uppspelning.
- Vendored motor `3c2b70b` plus demolånbok får inte bli spel-Neon eller ersätta `web/server.mjs`.
- `/studio` och `/bo` är namnkrockar. `lab/components/kevin-bo/` är partnerportalen, inte denna branch.
- Två mediagenerationer: okt-8-banken (66 MiB, Paow utan hål och tal) och appens v2 (Paow med hål och 132 filer). De får inte behandlas som samma underlag.
- crf 13 står i #10 och syns inte i trädet. −16 LUFS står i appens README.
- Mårten och Paows tal kom efter #10.
- Byggskripten för key, rum och läppsynk ligger utanför repot. En import utan dem kan inte återbyggas.
- `0a1279a` är inte spetsens historik. Hämta inte mot den SHA.
- GitGuardian-kontrollen för `91969107` är `queued`, conclusion tom, ingen fil/rad. Incidentlistan är inte läst. Det är inte ett klartecken.
- Kevins 43 tester kördes inte.
