# Organisation: masterplan

Beställd av Jakob 31 oktober 2026. **Målet är en begriplig produkt, färre överlappande implementationer och verifierbara leveranser.** Denna första leverans inventerar och organiserar arbetet; den aktiverar inte tal/GPU och ändrar inte produktion, databas eller Git-historik.

Börja i [nuläget](NULAGE.md), välj en [områdesplan](#ansvarsområden) och läs bara dess aktivitet och angivna källor. [Underlaget](UNDERLAG.md) visar hur rapporternas fynd har bedömts. [Arbetssättet](ARBETSSATT.md) styr tilldelning, avbockning och nya fynd. Produktens ingång är fortsatt [START-HERE](../../../START-HERE.md).

## Tre faser, med beslut mellan dem

| Fas | Mål och första uppgifter | Grind vidare |
| --- | --- | --- |
| **1. Fastställ och säkra** | Rätta dokumentdrift, preview-cookien, miljöinventeringen och releasekvittot. Verifiera säkerhetstäckning, CI-roller, återställning och F11:s kvarvarande driftacceptans. Förstädning bara med konsumentbevis. | Kvarvarande risker har ägare och bevis; fas 2 får börja per område när dess egna beroenden är uppfyllda. Ingen väntan på all kosmetisk städning. |
| **2. Konsolidera per kontrakt** | Generated speech med aktuellhetskontroll; färre cookie-, konfigurations-, adapter- och publiceringsvägar; kontrollerad materiallivscykel; medveten versionspolicy. | Ändrat beteende verifierat genom rätt kedja, gamla konsumenter ersatta och ersatt kod/tester borttagna. |
| **3. Välj strukturella steg** | Bedöm separat talprocess, större workspace-/releaseautomatisering och eventuell ny produktrepo. Genomför bara det vars nytta är visad efter fas 1–2. | Ett granskbart beslut per ingrepp, återgång och konkret acceptans. Repo-byte, DDL, radering och betald drift följer sina särskilda mandat. |

**Nivå är inte fas eller prioritet.** A = avgränsad rättning/inventering, B = konsolidering av ett kontrakt, C = förändrad system-/driftgräns. P1 = konkret säkerhets-/drift-/korrekthetsrisk, P2 = förenkling med belagd nytta, P3 = valbart strukturarbete. P0 används först vid verifierad akut påverkan. Inga kalenderlöften, mognadspoäng eller påhittade riskprocent är satta.

## Ansvarsområden

| Område och egen plan | Ansvar och gräns |
| --- | --- |
| [01 Repo och dokument](omraden/01-repo-och-dokument/OMRADESPLAN.md) | Ingångar, ordlista, dokumentdrift och systemkarta; ingen generell namnbyteskampanj. |
| [02 Release och drift](omraden/02-release-och-drift/OMRADESPLAN.md) | Releaseidentitet, health/version, återställning och eventuell automation. |
| [03 Auth och säkerhet](omraden/03-auth-och-sakerhet/OMRADESPLAN.md) | Cookies, appägd sessiontransport, behörighet och säkerhetsbevis. |
| [04 Spel och adaptrar](omraden/04-spel-och-adaptrar/OMRADESPLAN.md) | F11, native/partner/Provspel och processlokalt tillstånd; serverns spelregler/pengar bevaras. |
| [05 Tal och AI](omraden/05-tal-och-ai/OMRADESPLAN.md) | Generated/moving, Director/Gateway, röster, banker och Slack-restpunkten. |
| [06 Admin och produkt](omraden/06-admin-och-produkt/OMRADESPLAN.md) | Publicering, spelbarhet, partnerkontrakt och avgränsade UX-val. |
| [07 Data och media](omraden/07-data-och-media/OMRADESPLAN.md) | Scheman/readiness, referenser, materialbyte och gallring. |
| [08 Toolchain och CI](omraden/08-toolchain-och-ci/OMRADESPLAN.md) | Runtime-/typpaket, install-/testvägar och större workspaceval. |
| [Gemensamt](gemensamt/OMRADESPLAN.md) | Förstädning, env-inventering och Git-historikbeslut som korsar områden. |

Varje plan länkar till separata aktivitetsfiler. **Aktivitetsfilen är enda statuskällan för den nya aktiviteten.** Områdesplan och masterplan är index, inte parallella checklistor. `migrering/status.json` fortsätter ensam beskriva den avslutade migreringen, 20/20; organisationsarbetet ändrar inte migrationspoängen.

## Startordning och parallellisering

```text
Inventering och källbedömning (denna leverans)
  +-- DOC-01/02: aktuella guider och ord
  +-- SEC-01/03: cookie och säkerhetsbevis
  +-- REL-01/02/04: releasekvitto, restore-underlag och kontrollerad previewbas
  +-- GEM-02 + DAT-01: miljöer och schema-/rollbevis
  +-- GEM-01: förstädning med avgränsade kandidater
          |
          +-- GAM-01: F11 i isolerad preview
          +-- TAL-01/02: talets kodkontrakt
          +-- ADM-01 + DAT-02/03: publicering och livscykel
          +-- SEC-02, GAM-02/03, CI-01/02, DOC-03
                         |
                         +-- beslut: TAL-04, REL-03, CI-03, GEM-03
```

Detta är beroendegrupper, inte en order att starta alla aktiviteter. Högst **tre samtidiga skrivande områdesagenter** plus orkestrator initialt; färre om paket eller filer överlappar. Ett avgränsat fel kan gå före städningen. TAL-01:s kodprov kräver ingen GPU; betald AV-acceptans kräver ett senare avgränsat uppdrag. GEM-03:s beslutsunderlag kan läsas tidigt utan att repo-byte startas.

## Agentorganisation

| Roll | Modell i inventeringen | Uppdrag |
| --- | --- | --- |
| **MERGEAGENTEN** | Denna chatt | Integrera fynd, dela ut aktiviteter, granska diff/CI/ägarskap och merga enligt repoets verktyg. |
| **ARKITEKTEN – produkt och kontrakt** | Astra, max | Oberoende granskning av spel-, auth- och talkontrakt. |
| **DRIFTAGENTEN – moln och miljö** | Astra, high | Render/Vercel/Neon, release, miljöer och återställning. |
| **REPOAGENTEN – underlag och leverans** | Sol 6.1, high | Rapportfynd, GitHub/CI, filstruktur och toolchain. |

De tre separata chattarna är tills vidare läsande granskare. Senare skrivuppdrag får egen worktree under `.claude/worktrees`, `jakob/<verktyg>-*`, aktivitets-ID, tillåtna filer och slutprov. De får inte merga, köra DDL eller starta drift på eget initiativ. Små underagenter startas kallt, en uppgift åt gången; ingen avslutad underagent återupptas. [Arbetssättet](ARBETSSATT.md) innehåller brief och rapportmall.

## Klart för nästa steg

Inventeringens leverans är klar när underlagskatalogen är genomgången, rapportpåståenden skilts från färska bevis, molnåtkomstens luckor är synliga och aktivitetsstrukturen är granskad/länkad. Det betyder inte att produktens åtgärder är utförda. Välj därefter en liten första genomförandevåg; ändra inte alla områden samtidigt.
