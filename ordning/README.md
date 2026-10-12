# Ordning · masterplan för Scoutgaming-repot

Tillfällig arbetsmapp. Skapad 2026-10-12 på branch `jakob/repo-ordning` från
`main` `00ea55c5`. Den ersätter inget i `docs/` och tas bort i
[A99](aktiviteter/A99-slutavstamning.md) när arbetet är klart.

> **OBS: integrationsbranch.** Allt arbete samlas på `jakob/repo-ordning`
> (utkast-PR [#19](https://github.com/Jakeminator123/scoutgaming/pull/19)), inte
> på `main`. Molnagenter (`grok-4.7-xhigh-fast`) arbetar på egna brancher, och
> orkestratorn mergar in dem här lokalt. `origin/main` mergas in före varje
> körning. Inget når `main` förrän Jakob godkänt en milstolps-PR (se §5).

| Fil | Innehåll |
| --- | --- |
| Denna README | Fynd, beslut, vågor, beroenden och register |
| [ORKESTRERING.md](ORKESTRERING.md) | Hur molnagenter startas, mergas in och levereras |
| [BASLINJE.md](BASLINJE.md) | Frysta mätvärden, känd rörelse, produktionsfakta och lokala mappar |
| [aktiviteter/](aktiviteter/) | En brief per aktivitet |
| [verktyg/](verktyg/) | Mätskript som återskapar baslinjen |
| `rapporter/` | Läsande aktiviteter skriver sina rapporter hit |

## 1. Slutläge

Produkten är oförändrad för användaren. Repot visar dagens ansvar i stället för
gårdagens verkstäder.

```text
Hemsida + N3 /play ─ apps/croupier-frontend ─┐
N1 /control + N2 /partner ─ lab (Studio) ────┼─► publicerat paket ─► spelrum ─► spel
Spelmotor + spelarklient ─ web (Render) ─────┘          │
                                             gemensam uppspelning
                                  packages/presentation (kompositor, lager, urval)
                                  packages/platform (kontrakt, lagring, policy)
media/ = runtime + register   pipeline/ tools/ ops/ = aktiva verktyg   docs/ = fem dokument
```

Målet är inte att radera flest filer. Målet är att ingen aktiv del ska bero på
en experimentmapp, och att varje kvarvarande mapp har en tydlig ägare.

## 2. Vad koden och produktionsläsningen visar

Granskningen gällde `77b7605` i den gamla historiken. Allt nedan är kontrollerat
på `00ea55c5`, plus rörelsen till `e160af12` (BASLINJE §6). En Codex-överlämning
samma dag ("Astrid, trelager och nästa säkra rensning") bidrog med
produktionsfakta som bara lästes med SELECT (BASLINJE §8).

| Påstående | Kontroll | Följd |
| --- | --- | --- |
| `random/` och `planes/` kan tas bort | Ja, men `docs/system-map/verify.mjs` läser `random/checklista-2026-10-08.md` (planerad rad N2.4), och `catalog.json` pekar på fyra `planes/*/PLAN.md`. Raderas mapparna direkt blir pre-commit, pre-push och CI röda. | A01 flyttar spärrdatan först |
| 3D-spåret omfattar ~86 MB | Det är 129 496 385 byte för Astrid: `astrid-collection-sweep.glb` 40,4 MB, `runtime/indexed/rig` 65,0 MB och `source/3d` 24,1 MB. Till det kommer cirka 25 MB GLB för spelet. Ingen laddning finns i trelagerkedjan, vilket både mina mätningar och Codex visar. Elva tester i kroken och cirka 50 pipeline-skript håller spåret vid liv. | A10, A11 |
| Originalspelaren är legacy | Spelklienten kräver `local` eller `layered`. Gamla `/dealer/…` och `/dealers/astrid/…` svarar 410 (`web/server.mjs` ~1167). Originalmedia lever kvar som reservvisning i Studio, som läser index, talbank och performance-manifest. Den indexerade banken (~340 MB) läses av partnerprotokollet, röstreplikerna och katalogkontrollen i CI. | A12 (Studio-reserven), A30 (banken) |
| Handoffen: "Amira/Vera/Mei använder originalmotorn" | Motsägs av koden. I produktion matchar ingen av Astrids 10 registerposter de gamla Git-filerna, och inget av de 29 paketen med presentationsdata refererar dem via hash. | T1 är i praktiken löst; A02 rättar texten |
| `test-videoeditor/` är produktion | Ja. Frontendbygget, spelservern och Studio-bygget läser därifrån. `preview/site` har 29 filer (12,2 MB) för Paow och Dragge och inga Astrid-referenser. | A20 |
| Partnerportalen bär en prototypfabrik | Ja: `original-views.jsx` är 298 KB och `original.css` 70 KB. Bara Team är utbrutet. | A13 |
| Kevin: 110 före / 77 efter | Nu 113 före och 83 efter (`kevin` rör sig fortfarande). Separat app med egen deploy. Inkorg #10 väntar på svar. | A06, ingen helmerge |
| Historikrensning sist | Redan gjord 2026-10-12: `.git` 4,66 → 1,61 GB. Main-historiken är cirka 754 MB packat och övriga brancher cirka 834 MB (med överlapp). Raderade filer krymper inte `.git`, men raderade gamla brancher kan göra det efter `gc`. | A03 (brancher), inget nytt historikjobb |
| Paketfel: frysta paket saknar `transition.shoe` (Codex prio 1) | Rättat i `e160af12` ("Keep published dealer packages readable after optional shoe slots"). Full regression var grön enligt agenten `side-play-directory`. | Kontroll i A04 och A99 |
| (inte nämnt) Leveransmodell | GitHub kräver PR till `main` sedan 7 oktober, medan dokument och `push-github-work.mjs` säger direkt-push. Pre-push tillåter bara `main`. | A03, B1 (beslutat) |
| (inte nämnt) Render-imagen | `COPY . .` bakar in all `media/**/runtime`. Dealerfiler på disk är inte reservkälla för molnuppspelningen. | A31 |
| (inte nämnt) Död kod | 87 pipeline-skript saknar konsument. Av 122 klientfiler i `web/public` saknar 27 produktkonsument, bland dem fem spårade granskningssidor. 181 av 296 Markdown-filer är QA-anteckningar i staging. | A10, A14–A17 |
| (inte nämnt) `ops/vercel-entry`, `ops/caddy` | `ops/vercel-entry` är den gamla fristående Vercel-ingången, men dess `build.mjs` används av frontendbygget och tre tester. `preview/` är ett separat tillfälligt Vercel-projekt med lokal `.vercel` och `dist`. `ops/caddy/bettalotto-game-auth.Caddyfile` (bettalotto.se) har ingen konsument i repot, men kan köras på en extern server. | A18, B15 |
| (inte nämnt) Cursor-ignorerat | `.cursorignore` är identisk med `.ignore`. Cursor och `rg` ser inte `media/**/source`, `media/**/staging`, `media/layout.json`, `media/blob-index.json`, `vendor/`, binärer, `lab/data/` och `web/data/`. Mätverktygen använder `git ls-files` och påverkas inte. | ORKESTRERING §4 punkt 13 |
| (inte nämnt) Lokalt utanför Git | `lab/data` är 787 MB, varav `platform-private` 748 MB med QA-evidens och privata nycklar. Därtill en `.venv` på 161 MB i ditt 3lager-material, `.next`-cache på 172 MB, `media/.migration` på 9,5 MB (migreringsjournaler från 2 oktober) och genererade kopior i `apps/croupier-frontend/public`. | A19, B16 (Jakobs egna data) |

## 3. Principer

1. **Inget blir sämre.** En nåbar sida, länk eller handling får inte försvinna
   utan beslut. Pensionerade adresser omdirigeras.
2. **Beslut före radering av användarytor.** B-besluten nedan styr. Provisoriska
   beslut gäller bara på integrationsbranchen och bekräftas i milstolps-PR:en.
3. **Funktion först, test sedan.** Tester tas bort tillsammans med funktionen de
   skyddar, aldrig för att de blivit röda. Skydden för kort, sko, saldo,
   behörighet, publicerade paket, medieägarskap och uppspelning behålls.
4. **En aktivitet, en agentbranch.** Varje aktivitet äger en filista. Delade
   filer redigeras bara på egna rader (ORKESTRERING §5).
5. **Ingen produktion från agenter.** Inga migrationer, inga Neon-, Blob-,
   Render- eller Vercel-ändringar och inga lokala servrar. Produktion läses bara
   av orkestratorn, med SELECT.
6. **Medieregler gäller.** AGENTS.md "Dealer speech, media, cards, and wallet"
   gäller fullt ut. Registrerade molnobjekt och sparade referenser (12 bankklipp,
   72,3 MB i `runtime/presentation`) avregistreras inte.
7. **Flytta med historik.** Använd `git mv`, en ren flytt per commit.
8. **Tomma mappar tas bort.** Det gäller inte mappar med ospårat lokalt material,
   t.ex. `web/public/review/2026-09-09/3lager/`, `lab/data` och `web/data`.

## 4. Beslut

| ID | Fråga | Status | Spärrar |
| --- | --- | --- | --- |
| B1 | Leveransmodell | **Beslutat** (orkestratorn på Jakobs uppdrag 2026-10-12): feature-branch + PR. Pre-push tillåter `jakob/*`, `codex/*` och `cursor/*` utan force-push, radering eller taggar. Direkt-push till `main` är bara en uttrycklig admin-nödväg. | A03 |
| B2 | Hur når arbetet `main`? | **Beslutat** (Jakob 2026-10-12): via integrationsbranchen `jakob/repo-ordning` och en stor PR. Orkestratorn föreslår tre milstolps-PR:er (§5). | alla |
| B3 | `random/` och `planes/` ur Git | **Ja** (Jakob 2026-10-12) | A01 |
| B4 | Avveckla 3D-, rigg- och ansiktsspåret | **Provisoriskt ja.** Intern kod utan användaryta; bekräftas i M1. | A10 |
| B5 | `/casino.html` (3D-kasinogolv, olänkat) | Öppet. Rekommendation: pensionera med 308 till `/play`. | A11 |
| B6 | Originalmedia som Studio-reserv | Öppet. Rekommendation: pensionera när A04 visat att registrerad media finns. | A12 |
| B7 | Partnerportalens 24 diagnostiska vyer | **Provisoriskt:** bryt ut och isolera, ta inte bort något. Borttagning är öppen. | A13 |
| B8 | Staging- och experimentmedia | Öppet. Astrids staging innehåller kalibreringsmetadata och prövas per mapp. | A14 |
| B9 | Pipeline-skript utan konsument | **Provisoriskt ja.** Läppsynk- och kalibreringskedjan behålls. | A15 |
| B10 | `/v2`, composited-media (91 MB) och gamla granskningssidor | Öppet. Avgörs efter A04/A05. | A16 |
| B11 | Indexerad bank, originalmotor och partnerprotokoll | Öppet. A30 utreder först. | A30, A31 |
| B12 | Strukturfasen | Öppet. Rekommendation: ja till A20–A21, A22 efter utvärdering, A23 valfri. | A20–A23 |
| B13 | Brancher och worktrees | **Ja**, efter A03:s underlag (Jakob 2026-10-12). Lokala `ORCHISTRATOR` är redan raderad; dess commit fanns på `main`. | A03 |
| B14 | Kevin-integration | Öppet. Rekommendation: selektiv, i en egen plan. | (utanför) |
| B15 | Ops-arv: gamla `vercel-entry`-projektet, `preview/`, Caddy för bettalotto.se | Öppet. A18 utreder och flyttar `build.mjs` till frontendens ägo. | A18 |
| B16 | Lokala ignorerade mappar (`lab/data`, `.venv`, byggutdata, `media/.migration`) | Jakobs data. A19 ger förslag; inget raderas utan Jakob. | A19 |

### Tveksamt

| ID | Fråga |
| --- | --- |
| T1 | Handoffens påstående om originalmotorn. Koden och produktionsläsningen säger nej. A02 rättar texten och A04 bekräftar. |
| T2 | Vad gör `/v2` i dag, utöver att servera `game.html`? (A05) |
| T3 | Skyddar `pipeline/audit-astrid-actor.mjs` och `audit-performance.mjs` något som är live? (A05) |
| T4 | Filer i `ordning/` utlöser full pre-commit (cirka 3,5 minuter). Det accepteras hellre än att verktyget ändras. |
| T5 | `jakob-export` har 78 egna commits. Den rörs inte förrän Jakob sagt vad den är. |
| T6 | Körs `ops/caddy/bettalotto-game-auth.Caddyfile` på någon extern server? Svaret avgör B15. |

## 5. Vågor, omgångar och milstolpar

```text
Omgång 1 (startad 2026-10-12, molnagenter, parallellt):
  A01 A02 A03 A04 A05 A06    A10 A13 A15 A18    A30-fas1
                │
  merge in, main in, full svit, push ──► CI på PR #19
                │
Omgång 2 (efter A04/A05 + beslut B5 B6 B8 B10):
  A11 (efter A10)  A12  A14  A16  A19 (lokal, orkestratorn)
                │
Omgång 3:  A17  andra svepet + samlade dokument     ══► M1-PR till main (våg 1–2)
                │
Omgång 4:  A20 ─► A21 ─► A22 ─► (A23 valfri)  en i taget  ══► M2-PR
                │
Omgång 5:  A30 fas 2 ─► A31 ─► A99                       ══► M3-PR, ordning/ bort
```

| Milstolpe | Innehåll | Varför separat |
| --- | --- | --- |
| M1 | Våg 1–2: dokument, regler, inventeringar, avveckling av oanvänt | Låg risk. Hela sviten och CI bevisar mest. |
| M2 | Våg 3: flyttar till `packages/` | Ändrar runtime-sökvägar på Render, där branchen inte kan förhandsvisas. Behöver produktionskontroll direkt efter merge. |
| M3 | Våg 4 och A99: bank, media, slutavstämning | Kräver B11 och kontroll av Render-imagen. |

En enda stor PR går också, men då hamnar alla risker i samma deploy.
Milstolparna är min rekommendation.

## 6. Register

Status: `väntar` · `redo` · `körs` · `inmergad` (på integrationsbranchen) · `i M1/M2/M3` · `klar` · `struken`.

| ID | Aktivitet | Våg | Beroenden | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| [A00](aktiviteter/A00-start-och-arbetsytor.md) | Start, integrationsbranch och omgångar | 0 | – | 5 % | klar |
| [A01](aktiviteter/A01-random-och-planes.md) | Avveckla `random/` och `planes/` | 1 | B3 | 15 % | körs |
| [A02](aktiviteter/A02-handoff-och-readme.md) | Handoff, README och guide i takt med koden | 1 | – | 15 % | körs |
| [A03](aktiviteter/A03-agentregler-och-leverans.md) | Agentregler, leveransmodell, branchhygien | 1 | B1, B13 | 20 % | körs |
| [A04](aktiviteter/A04-medieinventering.md) | Medieinventering (läsande) | 1 | – | 5 % | körs |
| [A05](aktiviteter/A05-kodinventering.md) | Kodinventering (läsande) | 1 | – | 5 % | körs |
| [A06](aktiviteter/A06-kevin-underlag.md) | Kevin-branchen: underlag (läsande) | 1 | – | 5 % | körs |
| [A10](aktiviteter/A10-3d-rigg-ansikte.md) | 3D-, rigg- och ansiktsspåret | 2 | B4 (prov.) | 25 % | körs |
| [A11](aktiviteter/A11-kasinogolvet.md) | Kasinogolvet `/casino.html` | 2 | B5, A10 | 25 % | väntar |
| [A12](aktiviteter/A12-originalmedia-i-studio.md) | Originalmedia som Studio-reserv | 2 | B6, A04, A05 | 35 % | väntar |
| [A13](aktiviteter/A13-partnerportalens-prototyper.md) | Partnerportalens prototypfabrik | 2 | B7 (prov.) | 40 % | körs |
| [A14](aktiviteter/A14-staging-media.md) | Staging- och experimentmedia | 2 | B8, A04, A10, A15 | 15 % | väntar |
| [A15](aktiviteter/A15-pipeline-verkstaden.md) | Pipeline-verkstaden | 2 | B9 (prov.) | 15 % | körs |
| [A16](aktiviteter/A16-v2-och-composited.md) | `/v2`, composited-media och granskningssidor | 2 | B10, A04, A05, A11 | 45 % | väntar |
| [A17](aktiviteter/A17-andra-svepet-och-dokument.md) | Andra svepet, tomma mappar, samlade dokument | 2 | A10–A18 | 20 % | väntar |
| [A18](aktiviteter/A18-ops-arv.md) | Ops-arv: `vercel-entry`, `preview/`, Caddy | 2 | B15 för radering | 20 % | körs |
| [A19](aktiviteter/A19-lokal-hygien.md) | Lokala ignorerade mappar (orkestratorn) | 2 | B16 | 10 % | väntar |
| [A20](aktiviteter/A20-presentation-kompositor.md) | `packages/presentation`: kompositor och preview | 3 | B12, M1 | 30 % | väntar |
| [A21](aktiviteter/A21-presentation-runtime.md) | `presentation-runtime` in i paketet | 3 | A20 | 30 % | väntar |
| [A22](aktiviteter/A22-platform-karna.md) | `packages/platform`: delad kärna | 3 | A21, B12 | 45 % | väntar |
| [A23](aktiviteter/A23-appnamn-valfri.md) | Appnamn och tjänstegränser (valfri) | 3 | A22, B12 | 60 % | väntar |
| [A30](aktiviteter/A30-indexerad-bank.md) | Indexerad bank och partnerprotokoll | 4 | fas 1: – · fas 2: B11 | 50 % | fas 1 körs |
| [A31](aktiviteter/A31-media-ut-ur-tradet.md) | Tung media ut ur Git-trädet | 4 | A30, B11 | 45 % | väntar |
| [A99](aktiviteter/A99-slutavstamning.md) | Slutavstämning, drift, mappen bort | 4 | allt | 20 % | väntar |

Risk anger sannolikheten att aktiviteten kräver omtag eller ger en regression
som CI inte fångar. Den är en bedömning, inte en mätning.

## 7. Förväntad vinst

| Mått | Före | Efter M1 (uppskattat) | Efter M3 (om B11 = ja) |
| --- | --- | --- | --- |
| Spårade MiB | 790 | ~535 (−3D 148, −composited 91, −staging upp till 15) | ~255 (−indexerad bank 279) |
| Render-image (media/runtime) | ~690 MB | ~475 MB | ~195 MB, lägre om presentationsmedia flyttas till Blob |
| Markdown-filer | 296 | ~75 | ~70 |
| Pipeline-skript utan konsument | 87 | 0 | 0 |
| Klientfiler utan produktkonsument (`web/public`) | 27 | 0 | 0 |
| Lokal `.git` | 1,61 GB | lägre om gamla brancher raderas och `gc` körs | samma |
| Lokal mapp utanför Git | ~1,1 GB (`lab/data`, `.venv`, cache) | enligt B16 | – |

A99 mäter de faktiska värdena.

## 8. Rörelse under arbetet ("ta höjd")

- Före varje omgång mergar orkestratorn `origin/main` in i integrationsbranchen,
  kör hela sviten, pushar och startar först därefter agenterna.
- Briefar och promptar justeras mellan omgångarna när fakta ändras.
  Ändringarna committas på integrationsbranchen före nästa start.
- Varje aktivitet börjar med **steg 0**: läs BASLINJE §6 (känd rörelse), mät om
  och följ toleranserna i §7.
- Rörelse har redan skett: PR #16 och #18 (Dealer Forge) samt `/play`-fixen
  `e160af12` mergades medan planen skrevs.
- [A99](aktiviteter/A99-slutavstamning.md) stämmer av allt mot baslinjen och har
  en reservdel för drift som upptäcks sent.

## 9. Klart när

- [ ] Alla B-beslut är tagna eller uttryckligen strukna. Provisoriska beslut är
      bekräftade i respektive milstolps-PR.
- [ ] Varje aktivitet är `klar` eller `struken` med motivering.
- [ ] Full pre-commit, CI, Studio- och frontendbygge är gröna på slutlig `main`.
- [ ] Vercel och Render kör slutlig `main`. Röktest av `/`, `/play`, `/control`,
      `/partner/login`, rehearsal för fyra dealers och layer-lanen.
- [ ] `docs/JOHN-HANDOFF.md` och `docs/CLOUD-MIGRATION.md` beskriver resultatet.
- [ ] `ordning/`, agentbrancherna och integrationsbranchen är borttagna.
