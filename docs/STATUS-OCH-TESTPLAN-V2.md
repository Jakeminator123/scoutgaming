# Croupier V2 – lägesbild, testplan och vägen till molndrift

**Avstämt 28 september 2026 mot commit `44feeec`.** Detta dokument samlar
arbetet från migrations-/städchatten, molnchatten och läppsynkchatten.
Det är en statusbild och genomförandeplan, inte ett godkännande av driftsättning.
Senare ändringar måste verifieras för sin egen commit.

## Kort sagt

Koden är samlad på privata GitHub, och de tre automatiska CI-jobben är gröna.
Emils GPU-worker har importerats till samma repo och kopplats till en ny,
valbar strömmande talväg. Säker molninloggning och beständig lagring är
förberedda i kod. **Den kompletta V2-miljön kör ännu inte i molnet.**

Två olika saker återstår: att driftsätta och prova spel/BO/Lab med riktig
HTTPS och beständig disk, samt att prova den nya läppsynken på riktig GPU.
Ett lyckat Dockerbygge eller gröna kodtester bevisar inte något av dessa.

## Vad de tre arbetsdelarna har levererat

| Arbetsdel | Gjort | Viktig begränsning |
| --- | --- | --- |
| GitHub-migration, denna chatt | `origin`, arbetsflöde och standardbranch flyttade till `jakemanator123-github-work` i `Jakeminator123/github-work`. GitHub Actions och skyddad push-helper införda. Den andra agentens arbete följde med. | GitHub lagrar koden; det kör inte automatiskt hela produkten. |
| GitLab-paus, denna chatt | Gamla mirror-pushar, inbox och GitLab-uppföljning pausade. `Jakobs-v1` vid `600093e` verifierad på båda tjänsterna. | Taggen skyddar spårat material, inte privata databaser, hemligheter eller externa tjänster. |
| Städning, denna chatt | Cirka 167 MiB inbox/testbygge/cache raderat efter godkännande. 39 gamla dokument/arkivfiler och GitLab-mallen borttagna i andra städomgången; tidigare fyra engångsprompter och fyra inmergade lokalbrancher borttagna. | Inboxen var ignorerad och kan inte återställas via Git. Dokumenten finns i v1-historiken. Aktiva media och spardata är kvar. |
| Motorinventering, denna chatt | Lissabons spel-, presentations- och animationskedja kartlagd. Läsande kontroll `tools/cloud-readiness.mjs` tillagd. | Ingen separat saknad ”bo-events”-motor ska installeras. Det är befintlig motor och dess presentationer som ska få rätt driftmiljö. |
| Molnagenten | `ops/cloud/` med separat spel-/BO-/Lab-routing, BO→Lab-inloggning, sessionsåterkallelse och första administratör på tom databas. Kamera, Whisper och genererat tal kan aktiveras uttryckligen. | Molnstarten är fortfarande spärrad i kod. Verkliga värdnamn, cookies, återstart och hela användarflödet är inte godkända. |
| Data/backup, molnagenten | Privat backup och isolerad återläsning dokumenterad: 38 hashkontrollerade poster; två SQLite-databaser gav `integrity_check = ok`. | Fil-/databasintegritet är provad enligt handoffen, inte en komplett spelrunda efter molnåterställning. Ingen privat data ska flyttas utan beslut. |
| Läppsynkagenten | Emils worker importerad till `services/astrid-gpu-worker`. Strömmande ljud→video integrerat med serverns sessionskontroll och gemensamma spelare. | Avstängt som standard. Verklig GPU-latens, bildkvalitet och läppsynk återstår. |
| GPU-byggkedjan | Separat manuellt CPU-provbygge av worker-imagen passerade, inklusive båda avatarernas förberedda data och modulimporter. | Imagen publicerades inte. Ingen ny GPU-inferens eller betald testkörning genomfördes i den leveransen. |

Städningens exakta avgränsning finns i [städrapporten](REPOSITORY-CLEANUP.md).
Äldre `inbox-publish`-worktree lämnades kvar eftersom ägarskap/aktivitet inte
var säkert fastställt; det aktiva GPU-arbetets worktree ska inte rensas som skräp.

## Vad som faktiskt är verifierat

Följande två GitHub-resultat lästes på nytt när detta dokument skrevs:

- [CI för `44feeec`](https://github.com/Jakeminator123/github-work/actions/runs/36474929456):
  `presentation-studio`, `dealer-regression` och `lipsync-worker` är alla
  avslutade med `success`. Det omfattar studio/test/bygge, spel- och
  mediaregression samt worker-/relätester.
- [CPU-Dockerbygge för `7644c44`](https://github.com/Jakeminator123/github-work/actions/runs/36471104794):
  avslutat med `success`. Detta är ett separat äldre byggkvitto, inte en ny
  image byggd och driftsatt från `44feeec`.

Enligt [streamingrapporten](STREAMING-INTEGRATION.md) har Chrome dessutom
spelat två syntetiska strömmar i följd genom riktiga transport-/uppspelningsdelar.
Första bild kom efter 897 respektive 1 031 ms. **Det var syntetiskt ljud och
syntetiska ansiktsrutor, inte verklig Cartesia plus GPU.** Siffrorna får inte
användas som löfte om produktens svarstid.

Backupresultaten och tidigare lokala prov ovan är dokumenterade av respektive
agent; de privata backupfilerna öppnades inte och proven kördes inte om för
denna lägesbild. Inget nytt mänskligt läppsynksgodkännande ges här.

## Så hänger GitHub, Vercel, backend och GPU ihop

GitHub är den gemensamma källan. Vercel är en tänkt ingång/frontend, inte en
ersättning för alla serverprocesser och data. Första föreslagna driftbild:

```text
Privat GitHub: Jakeminator123/github-work
  branch: jakemanator123-github-work
        |
        +--> Vercel: ingång som länkar till spelet
        |
        +--> Beständig backend, föreslaget Render
        |      spel + BO + Next Lab bakom skyddad HTTPS
        |      gemensam disk för SQLite, projekt, historik och privat media
        |      separata värdnamn för spel, BO och Lab
        |
        +--> GPU-image i valt register, föreslaget GitHub Container Registry
               separat RunPod-testmiljö för Emils worker
               autentiserad anslutning till spelets talrelä
```

Detta är en **föreslagen målbild**, inte redan skapade tjänster. Behåll ett
monorepo men bygg separata driftsenheter. Börja med en produkt-/reläinstans;
delat sessions-/jobbminne och horisontell skalning är inte färdigverifierade.

Lissabons server avgör kort, saldo och utbetalningar. Presentationsevents
väljer klipp som spelas i webbläsaren. AI-råd och GPU-video får inte bli
auktoritet för spelets ekonomi eller regler.

Första Vercel-ingången bör länka till spelets backend-origin. Den nya
strömningen kräver i nuvarande integration samma origin för spel och
WebSocket. Att flytta själva spelklienten till en annan origin kräver separat
arbete med anslutning, sessionsöverlämning och tester. Den gamla Vercel-sajten
`animation-events-v1` är dokumentation och ska inte misstas för spelet.

## Emils repo: importerat betyder inte färdigutflyttat från GitLab

Importerad källa är `EmaCodeHero/astrid-gpu-worker`, upstream `d3a2d0a6`.
[SOURCE.md](../services/astrid-gpu-worker/SOURCE.md) anger ursprung och den
lokala streamingimplementationen. Arbetskopian ligger nu i Croupiers GitHub-
repo; detta betyder inte att Emils externa repo eller fullständiga Git-historik
har flyttats, ändrats eller stängts.

Enligt den dokumenterade endpoint-inspektionen använder befintlig RunPod-drift
fortfarande `registry.gitlab.com/emacodehero/astrid-gpu-worker:d3a2d0a6`.
Den uppgiften är ett tidigare läsande kvitto, inte en ny livekontroll här.
**GitLab-beroendet i GPU-driften är alltså inte borttaget bara för att koden
ligger på GitHub.** Den importerade underkatalogen innehåller även gammal
GitLab-CI som källhistorik; Croupiers egna jobb körs i GitHub Actions.

Full flytt kräver ett nytt publicerat imagepaket, behörighet för RunPod att
hämta det, ett verifierat byte av test-endpoint och därefter ett godkänt
driftbyte. Föreslaget register är GitHub Container Registry (GHCR); namn,
åtkomst, lagring och eventuella kostnader ska bestämmas först. Behåll den
gamla imagen som återgång tills den nya fungerar. Ändra inte Emils ursprungsrepo
eller den befintliga produktionsendpointen som bieffekt.

## Planen, i ordning

### 1. Beslut och avgränsning

- Jakob väljer separat kostnadstak för molninstans/disk och GPU-provet.
  Agentens förslag **högst 5 USD för GPU-testet är ännu inte ett godkännande**.
  Ange också testlängd, stoppansvar och hur kvarvarande jobb/idleworkers stängs.
- Välj tom testdata eller uttryckligen godkänd privat kopia. Rekommendation:
  **tom, isolerad testmiljö först**. Befintliga lokala databaser lämnas kvar.
- Bestäm Vercel-projekt, backendtjänst, tre HTTPS-värdnamn, register och
  separat GPU-test-endpoint. Detta dokument startar eller beställer inget.

### 2. Gör molnstarten testbar och säker

- Granska `ops/cloud/start.mjs`: `assertCloudAccessReady()` kastar alltid fel.
  Fler miljövariabler räcker inte; en kodändring och granskad teststart behövs.
  Använd isolerad, skyddad staging för första driftprovet, inte publik öppning
  eller borttagna autentiseringsspärrar för att få startaren att gå igenom.
- Bygg produktens egen image från en bestämd GitHub-commit. GPU-imagens
  godkända byggkvitto bevisar inte att denna andra image är byggd.
- Montera beständig disk, skydda konfiguration och skapa första admin med
  engångsbootstrap. Ta bort bootstrap-hemligheterna efter kontoskapandet.
- Prova spel/BO/Lab med verklig HTTPS, återkallad session och omstart innan
  åtkomst öppnas. Ingen lokal profil utan lösenord får bli en publik genväg.

### 3. Prova spel och sparande utan GPU

- Starta testmiljön med kamera och betalt genererat tal avstängda.
- Spela riktiga rundor med befintliga klipp och verifiera serverägda utfall,
  saldo, shoe, presentationsval, sparat projekt och omstart.
- Prova återställning från en testbackup och spela vidare. Att filer kan
  kopieras eller SQLite svarar `ok` räcker inte för denna acceptans.
- Skapa/länka Vercel-ingången efter godkänt driftbeslut och testa från en
  annan dator utan lokala Croupier-servrar.

### 4. Slutför transporten och prova riktig GPU

- Molngatewayen saknar ännu WebSocket-upgrades och håller strömning avstängd.
  Implementera och testa den autentiserade transporten för klient och worker,
  inklusive Host/Origin, sessionsägare, avbrott och timeout. Gör detta innan
  en GPU lämnas väntande på en anslutning som inte kan fungera.
- Bygg och publicera den valda streaming-imagen med versionsidentifierare
  och digest. Verifiera privat imagehämtning i den separata test-endpointen.
- Kör inom godkänd budget. Mät kall och varm start, första ljud/bild,
  full svarstid, bildtakt, A/V-synk, avbrott och faktisk kostnad. Granska
  munrörelser på samma exakta repliker, inte bara transportens tidsstämplar.
- Stoppa testjobb och kontrollera att inga testworkers debiteras vidare.
  Produktionsendpointen byts först efter resultat och godkännande.

### 5. Aktivera Astrids hela kedja och lämna över

- Aktivera kamera, mikrofon, Whisper, bildtolkning och genererat tal stegvis.
  Verifiera riktig enhet och samtycke, inte bara simulerade browserhändelser.
- Testa `Record → ”Astrid” → svensk/engelsk fråga → engelsk text → AI-svar
  → röst/video`, med rätt sessionsägare och utan hemligheter i klienten.
- Labbets äldre talbrygga stöder färdiga filer, inte den nya strömtypen.
  Välj om första releasen ska behålla den gränsen eller utöka bryggan och testa
  även den. ”Allt fungerar” får inte omfatta en ännu ostödd väg.
- Dokumentera releasecommit, imagedigests, driftsadresser, testkvitton,
  kända fel, backup och återgång. Separera godkänd testmiljö från produktions-
  eller real-money-beredskap; demot är inte verifierat för riktiga pengar.

## Testprotokoll för nästa agent

Alla rader nedan är **kvar att godkänna i avsedd fjärrmiljö**. Registrera
commit/image, miljö, datum, testdata, faktiskt resultat och evidens per rad.
Loggar och skärmbilder ska inte publicera nycklar eller privata spelarminnen.

| ID | Prov | Godkänt när |
| --- | --- | --- |
| T01 | Åtkomst | Spel, BO och Lab når rätt tjänst via HTTPS; anonym/felaktig åtkomst och förfalskade headers nekas. |
| T02 | Admin/session | Första admin skapas säkert; engångskod kan inte återanvändas; utloggning/roll-/lösenordsändring återkallar sessioner. |
| T03 | Spel och media | Runda, kort, shoe, saldo och payout är korrekta; rätt film/familj/replik används och media kan strömmas/sökas. |
| T04 | Beständighet | Projekt och speldata överlever omstart; ingen dubblerad utbetalning eller borttappat tillstånd. |
| T05 | Backup/restore | Isolerad återställning klarar både integritetskontroll och en riktig fortsatt spelrunda. |
| T06 | Strömtransport | Autentiserad worker och spelklient ansluter genom molningången; fel ägare nekas och avbrott frigör resurser. |
| T07 | GPU | Verklig kall/varm latens och kostnad redovisas; visuell läppsynk och A/V-synk godkänns för de provade replikerna. |
| T08 | Två uppspelningar | Två svar i följd fungerar utan ljuddubblering eller fastnad kö; alla fyra dealers får föreskriven rehearsalgranskning. |
| T09 | Tal/bild | Fysisk mikrofon/kamera med samtycke, Whisper och vald bildmodell fungerar genom driftsatt kedja. |
| T10 | Fel och stopp | Nät-/GPU-bortfall ger begripligt fel, inte automatisk andra betalning; timeout och testavslut stänger resurser. |
| T11 | Utan lokal dator | All avsedd funktion nås från annan dator med lokala produktservrar stoppade. |
| T12 | GitHub-only drift | Ny image hämtas från valt icke-GitLab-register; inga nödvändiga build-/runtimeanrop kräver det gamla GitLab-registret. |

## Källor och återgång

- [GitHub-flytt och v1-ankare](GITHUB-MIGRATION.md)
- [Städning och vad som inte kan återställas](REPOSITORY-CLEANUP.md)
- [Tekniskt molnunderlag](CLOUD-MIGRATION.md) och [molnpaketets faktiska spärrar](../ops/cloud/README.md)
- [Läppsynkens implementation och testkvitton](STREAMING-INTEGRATION.md)
- [Emils källproveniens](../services/astrid-gpu-worker/SOURCE.md)
- [Löpande teknisk handoff](JOHN-HANDOFF.md)

Handoffens äldre avsnitt beskriver sina dåvarande lägen och är inte sorterade
som en enda aktuell status. Utgå från daterat testkvitto och exakt commit.
En kodrollback, en databasåterställning och ett byte av GPU-image är tre
separata åtgärder; v1-taggen ensam återställer inte hela driftmiljön.
