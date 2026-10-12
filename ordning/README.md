# Ordning · masterplan för Scoutgaming-repot

Tillfällig arbetsmapp. Skapad 2026-10-12 på branch `jakob/repo-ordning` från
`main` `00ea55c5`. Den ersätter inget i `docs/` och tas bort i
[A99](aktiviteter/A99-slutavstamning.md) när arbetet är klart.

| Fil | Innehåll |
| --- | --- |
| Denna README | Fynd, beslut, vågor, beroenden och register |
| [ORKESTRERING.md](ORKESTRERING.md) | Hur grok-agenter startas, granskas och levereras |
| [BASLINJE.md](BASLINJE.md) | Frysta mätvärden att jämföra mot |
| [aktiviteter/](aktiviteter/) | En brief per aktivitet, färdig att ge en agent |
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
media/ = runtime + register   pipeline/ tools/ = aktiva verktyg   docs/ = fem dokument
```

Målet är inte att radera flest filer. Målet är att ingen aktiv del ska bero på
en experimentmapp, och att varje kvarvarande mapp har en tydlig ägare.

## 2. Vad jag fann jämfört med granskningen

Granskningen gällde `77b7605` i den gamla historiken. Allt nedan är kontrollerat
på `00ea55c5`.

| Granskningens påstående | Kontroll i koden | Följd |
| --- | --- | --- |
| `random/` och `planes/` kan tas bort | Stämmer, men `docs/system-map/verify.mjs` läser `random/checklista-2026-10-08.md` (planerad rad N2.4), och `catalog.json` pekar på fyra `planes/*/PLAN.md`. Raderas mapparna direkt blir pre-commit, pre-push och CI röda. | A01 flyttar spärrdatan först |
| 3D-spåret omfattar ~86 MB | Spåret är större: dessutom `astrid-collection-sweep.glb` (38,5 MB). Astrids 3D-material är 123,5 MB, plus 24 MB GLB i `media/game/runtime/assets`. Elva tester i kroken och ~50 pipeline-skript håller det vid liv. | A10, A11 |
| Originalspelaren är legacy | Spelklienten (`web/public/app.mjs`) kräver `local` eller `layered` och kastar annars. Originalmedia lever kvar som reservvisning i Studio (Stage, Händelser, Uppspelning, Klippbibliotek med flera). Den indexerade banken (~340 MB) läses av partnerprotokollet, röstreplikerna och katalogkontrollen i CI. | A12 för Studio-reserven, A30 för banken |
| Handoffen: "Amira/Vera/Mei använder originalmotorn" | Motsägs av spelklientens kod. Behöver kontrolleras mot frysta paket. | T1, A04 |
| `test-videoeditor/` är produktion | Stämmer. Frontendbygget, spelservern och Studio-bygget läser därifrån, och `preview/site` (11,7 MB) är runtime för layer-lanen. | A20 |
| Partnerportalen bär en prototypfabrik | Stämmer: `original-views.jsx` 298 KB och `original.css` 70 KB. Bara Team är utbrutet. | A13 |
| Kevin: 110 före / 77 efter | Nu 113 före / 83 efter. Separat app med egen deploy. Inkorg #10 väntar på svar. | A06, ingen helmerge |
| Historikrensning sist | Redan gjord 2026-10-12: `.git` 4,66 → 1,61 GB. Att ta bort media nu krymper inte `.git`. | Inget nytt historikjobb |
| (inte nämnt) | GitHub kräver PR till `main` sedan 7 oktober, men dokument, regler och `push-github-work.mjs` säger direkt-push. Pre-push tillåter bara `main`. | A03, B1 |
| (inte nämnt) | Render-imagen gör `COPY . .`, så all `media/**/runtime` bakas in i spelmotorn. Medieflytt påverkar Render. | A30, A31 |
| (inte nämnt) | 87 pipeline-skript saknar konsument. 13 klientmoduler används bara av tester. 181 av repots 296 Markdown-filer ligger i staging. | A14, A15, A17 |

## 3. Principer

1. **Inget blir sämre.** En nåbar sida, länk eller handling får inte försvinna
   utan beslut. Pensionerade adresser omdirigeras.
2. **Beslut före radering.** Allt som tar bort något en användare når kräver ett
   B-beslut nedan. Det som är tveksamt lyfts under `Tveksamt` och mergas inte
   utan Jakobs ord.
3. **Funktion först, test sedan.** Tester tas bort tillsammans med funktionen de
   skyddar, aldrig för att de blivit röda. Skydden för kort, sko, saldo,
   behörighet, publicerade paket, medieägarskap och uppspelning behålls.
4. **En aktivitet, en branch, en PR.** Varje aktivitet äger en filista.
   Delade filer redigeras bara på egna rader (se ORKESTRERING §5).
5. **Ingen produktion från agenter.** Inga migrationer, Neon-, Blob-, Render-
   eller Vercel-ändringar och inga lokala servrar. Läsning av produktion görs av
   orkestratorn.
6. **Medieregler gäller.** AGENTS.md "Dealer speech, media, cards, and wallet"
   gäller fullt ut. Godkända tagningar regenereras aldrig.
7. **Flytta med historik.** Använd `git mv`, en ren flytt per commit, innan
   innehållet ändras.

## 4. Beslut som Jakob tar

| ID | Fråga | Min rekommendation | Spärrar |
| --- | --- | --- | --- |
| B1 | Leveransmodell | Feature-branch `jakob/*` + PR, som GitHub-regeln redan kräver. Pre-push tillåter då sådana brancher utan force-push eller radering. | A03 (verktyg och regler) |
| B2 | Ska planen till `main`? | Ja. Merga PR:en för `jakob/repo-ordning` först, så att alla aktivitetsbrancher ser planen. | Våg 1 |
| B3 | `random/` och `planes/` ur Git | Ja, efter att öppna punkter flyttats till `docs/CLOUD-MIGRATION.md` | A01 |
| B4 | Avveckla 3D-, rigg- och ansiktsspåret | Ja. Produkten är videobaserad. | A10 |
| B5 | `/casino.html` (3D-kasinogolv, olänkat) | Pensionera, med 308 till `/play` | A11 |
| B6 | Originalmedia som reserv i Studio | Pensionera när A04 visat att registrerad media finns | A12 |
| B7 | Partnerportalens diagnostiska vyer (24 st) | Behåll fixturen för de fyra live-sektionerna. Ta bort Roulette, Baccarat och interna prototyper som inte är kopplade. | A13 |
| B8 | Staging- och experimentmedia (1 341 filer) | Ta bort ur trädet; de finns kvar i Git-historiken och privat backup | A14 |
| B9 | Pipeline-skript utan konsument | Ta bort, men behåll läppsynk- och kalibreringskedjan | A15 |
| B10 | `/v2` och nycklad composited-media (91 MB) | Avgör efter A04/A05 | A16 |
| B11 | Indexerad bank, originalmotor och partnerprotokoll | Utred först (A30), besluta sedan | A30, A31 |
| B12 | Strukturfasen | Ja till A20–A21. A22 efter utvärdering. A23 är valfri och senare. | A20–A23 |
| B13 | Brancher och worktrees | Radera mergade remote-brancher. Städa worktrees utan osparat arbete. | A03 |
| B14 | Kevin-integration | Selektiv och i en egen plan, baserad på A06 | (utanför planen) |

### Tveksamt redan nu

| ID | Fråga |
| --- | --- |
| T1 | `docs/JOHN-HANDOFF.md` (avsnittet "Rätt dealer") säger att Amira/Vera/Mei använder originalmotorn. Spelklienten accepterar bara `local` och `layered`. Vilket gäller för publicerade rum? |
| T2 | Vad gör `/v2` i dag, utöver att servera `game.html`? |
| T3 | Skyddar `pipeline/audit-astrid-actor.mjs` och `audit-performance.mjs` i kroken något som är live? |
| T4 | Plan- och rapportfiler i `ordning/` utlöser full pre-commit, eftersom de inte står i dokumentlistan i `tools/precommit-checks.mjs`. Det accepteras: tiden mot att röra verktyget. |
| T5 | `jakob-export` har 78 egna commits. Raderas den inte förrän Jakob sagt vad den är. |

## 5. Vågor och beroenden

```text
Våg 0  A00 start ──► B1–B3
          │
Våg 1  ┌──┴──┬─────┬─────┬─────┬─────┐        alla parallella
       A01   A02   A03   A04   A05   A06       (A01+A02 levereras ihop)
                         │     │
                 beslut B4–B10 + rapporterna A04/A05
                         │
Våg 2  ┌────┬────┬────┬──┴─┬────┬────┐        parallella, merge i ordning
       A10  A12  A13  A15  A16  A14
        │                         (A14 efter A10/A15)
       A11 (efter A10)
        └────────────┬────────────┘
                    A17  andra svepet + samlade dokument
                     │
Våg 3  A20 ──► A21 ──► A22 ──► (A23 valfri)  en i taget
                     │
Våg 4  A30 ──► A31 ──► A99  slutavstämning, drift, mappen bort
```

| Våg | Parallellt | Sekventiellt | Varför |
| --- | --- | --- | --- |
| 1 | A01–A06 | A01 och A02 i samma merge | Skilda filer; tre aktiviteter är läsande |
| 2 | A10, A12, A13, A15, A16 | A11 efter A10, A14 efter A10/A15, A17 sist | Delade filer: krok, systemkarta, `server-ui.mjs` |
| 3 | – | A20 → A21 → A22 → A23 | Flyttar importvägar genom hela repot |
| 4 | – | A30 → A31 → A99 | Kräver beslut och drift-kontroll |

## 6. Register

Orkestratorn uppdaterar statusen. Status: `väntar` · `redo` · `pågår` · `granskas` · `PR #n` · `klar` · `struken`.

| ID | Aktivitet | Våg | Beroenden | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| [A00](aktiviteter/A00-start-och-arbetsytor.md) | Start, plan-PR och arbetsytor | 0 | – | 5 % | redo |
| [A01](aktiviteter/A01-random-och-planes.md) | Avveckla `random/` och `planes/` | 1 | B3 | 15 % | väntar |
| [A02](aktiviteter/A02-handoff-och-readme.md) | Handoff, README och guide i takt med koden | 1 | – | 15 % | väntar |
| [A03](aktiviteter/A03-agentregler-och-leverans.md) | Agentregler, leveransmodell, branchhygien | 1 | B1, B13 | 20 % | väntar |
| [A04](aktiviteter/A04-medieinventering.md) | Medieinventering (läsande) | 1 | – | 5 % | väntar |
| [A05](aktiviteter/A05-kodinventering.md) | Kodinventering (läsande) | 1 | – | 5 % | väntar |
| [A06](aktiviteter/A06-kevin-underlag.md) | Kevin-branchen: underlag (läsande) | 1 | – | 5 % | väntar |
| [A10](aktiviteter/A10-3d-rigg-ansikte.md) | 3D-, rigg- och ansiktsspåret | 2 | B4, A04, A05 | 25 % | väntar |
| [A11](aktiviteter/A11-kasinogolvet.md) | Kasinogolvet `/casino.html` | 2 | B5, A10 | 25 % | väntar |
| [A12](aktiviteter/A12-originalmedia-i-studio.md) | Originalmedia som Studio-reserv | 2 | B6, A04, A05 | 35 % | väntar |
| [A13](aktiviteter/A13-partnerportalens-prototyper.md) | Partnerportalens prototypfabrik | 2 | B7, A05 | 40 % | väntar |
| [A14](aktiviteter/A14-staging-media.md) | Staging- och experimentmedia | 2 | B8, A04, A10, A15 | 15 % | väntar |
| [A15](aktiviteter/A15-pipeline-verkstaden.md) | Pipeline-verkstaden | 2 | B9, A05 | 15 % | väntar |
| [A16](aktiviteter/A16-v2-och-composited.md) | `/v2` och nycklad composited-media | 2 | B10, A04, A05 | 45 % | väntar |
| [A17](aktiviteter/A17-andra-svepet-och-dokument.md) | Andra svepet och samlade dokument | 2 | A10–A16 | 20 % | väntar |
| [A20](aktiviteter/A20-presentation-kompositor.md) | `packages/presentation`: kompositor och preview | 3 | B12, A17 | 30 % | väntar |
| [A21](aktiviteter/A21-presentation-runtime.md) | `presentation-runtime` in i paketet | 3 | A20 | 30 % | väntar |
| [A22](aktiviteter/A22-platform-karna.md) | `packages/platform`: delad kärna | 3 | A21, B12 | 45 % | väntar |
| [A23](aktiviteter/A23-appnamn-valfri.md) | Appnamn och tjänstegränser (valfri) | 3 | A22, B12 | 60 % | väntar |
| [A30](aktiviteter/A30-indexerad-bank.md) | Indexerad bank och partnerprotokoll | 4 | A12, A16, B11 | 50 % | väntar |
| [A31](aktiviteter/A31-media-ut-ur-tradet.md) | Tung media ut ur Git-trädet | 4 | A30, B11 | 45 % | väntar |
| [A99](aktiviteter/A99-slutavstamning.md) | Slutavstämning, drift, mappen bort | 4 | allt | 20 % | väntar |

Risk anger sannolikheten att aktiviteten kräver omtag eller ger en regression
som CI inte fångar. Den är en bedömning, inte en mätning.

## 7. Förväntad vinst

| Mått | Före | Efter våg 2 (uppskattat) | Efter A30–A31 (om B11 = ja) |
| --- | --- | --- | --- |
| Spårade MB | 790 | ~535 (−3D 148, −composited 91, −staging 15) | ~255 (−indexerad bank 279) |
| Render-image (media/runtime) | ~690 MB | ~475 MB | ~195 MB, lägre om även presentationsmedia flyttas till Blob |
| Markdown-filer | 296 | ~75 | ~70 |
| Pipeline-skript utan konsument | 87 | 0 | 0 |
| Lokal `.git` | 1,61 GB | 1,61 GB (historiken behåller blobbar) | 1,61 GB |

Siffrorna efter våg 2 förutsätter att B4, B5, B8 och B10 blir ja. A99 mäter de
faktiska värdena.

## 8. Rörelse under arbetet ("ta höjd")

- Varje aktivitet börjar med **steg 0**: frys `origin/main`, jämför mot
  [BASLINJE.md](BASLINJE.md) med verktygen och uppdatera filistan. Läs
  den kända rörelsen i BASLINJE §6 och följ toleranserna i §7.
- Rörelse har redan skett: medan planen skrevs mergades PR #16 Dealer Forge
  (`234614e3`, 35 filer, bland annat `AGENTS.md`, `docs/` och ett nytt
  `sharp`-beroende i `lab`).
- Före varje start kontrollerar orkestratorn öppna PR:er (nu #16 Dealer Forge),
  agent-talk-tavlan och inkorgen.
- Sedan baslinjen nytillkommen kod i ett område som ska avvecklas läggs till
  under `Tveksamt` och raderas inte automatiskt.
- [A99](aktiviteter/A99-slutavstamning.md) mäter om allt mot baslinjen,
  stämmer av det som ändrats på `main` under arbetet och har en reservdel för
  drift som upptäcks sent.

## 9. Klart när

- [ ] Alla B-beslut är tagna eller uttryckligen strukna.
- [ ] Varje aktivitet är `klar` eller `struken` med motivering.
- [ ] Full pre-commit, CI, Studio- och frontendbygge är gröna på slutlig `main`.
- [ ] Vercel och Render kör slutlig `main`. Röktest av `/`, `/play`,
      `/control`, `/partner/login`, rehearsal för fyra dealers och layer-lanen.
- [ ] `docs/JOHN-HANDOFF.md` och `docs/CLOUD-MIGRATION.md` beskriver resultatet.
- [ ] Mappen `ordning/` är borttagen.
