# Croupier: aktuell källa, drift och leverans

Arbeta i `C:\Users\jakem\Projects\croupier`, på `main` i det privata
[Jakeminator123/github-work](https://github.com/Jakeminator123/github-work).
`main` är enda lokala/GitHub-branch och standardbranch sedan 2 oktober 2026.
Vercels produktionsbranch och fyra befintliga Render-kopplingar är `main`.
Produktens Render-autodeploy är `checksPass`; övriga tre är fortsatt `off`.
GitLab-inbox, wiki och spegelpush är pausade; återskapa inte gammal inbox.
`Jakobs-v1` bevarar commit `600093e4522efc57bd82979cff65492a528ffeb7`.
Ignorerade privata data ingår inte i Git-taggen.

## Fem dokument i docs

- [JOHN-HANDOFF.md](JOHN-HANDOFF.md): senaste verifierade arbete och öppna fel.
- [ENVIRONMENT-RESTORATION.md](ENVIRONMENT-RESTORATION.md): data, backup och mediaregler.
- [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md): namn, placering och villkor.
- [LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md): ansvar och uppspelning.
- Detta dokument: källa, driftskarta och leverans.

Uppdatera befintliga dokument kort; skapa inte fler daterade rapporter eller
sprintarkiv innan Jakob ber om ny dokumentation. Labbets användarguide och
OpenClaws versionsbundna källindex ligger nära respektive implementation.
JSON-register, media, acceptansbaseline och befintliga QA-kvitton bevaras.

## Ytor och datalagring

| Yta/data | Ansvar och plats |
| --- | --- |
| Publik frontend | `apps/croupier-frontend`, Vercel `croupier-frontend`; [scoutgaming.tech](https://www.scoutgaming.tech/) |
| Spelgränssnitt | Vercel [scoutgaming.tech/game](https://www.scoutgaming.tech/game); Render äger slump, kort, shoe, regler, wallet och resultat |
| Backoffice/Lab | Vercel [scoutgaming.tech/studio](https://www.scoutgaming.tech/studio), gemensam navigation för Studio, media, event, zoner, OpenClaw och uppspelning; `/studio/tree` är allmänna editorn |
| Administration | `/studio/administration` återanvänder befintlig `/bo`; samma konton och rollkontroller, ingen separat dealerström |
| Lokal beständig data | `lab/data` för projekt, historik och profiler; `lab/data/players` för konto-/speldatabaser; Lissabon är borttagen med privat backup |
| Spelarkonton/rundor | Separat Neon game-databas, schema `croupier_game` |
| CRAIG/BO-konton | Samma game-databas, separat schema `croupier_auth` |
| Studio-projekt/index | `/var/data/studio`, beständig Render-disk |
| Privata media | Vercel Blob `croupier-media-private`, skyddad serverrutt med hash/familj/Range |
| Zonmetadata | Dedikerad Neon, schema `croupier_zones`; browserkopia är separat |
| Director/Gateway | Egna beständiga diskar, se återställningsguiden |

### Blob är ett gemensamt filarkiv, inte två tjänster

Lagret `store_AqwvebTbBHarOjvG` heter nu `croupier-media-private`, är privat
och ligger i Stockholm. All media har roten `croupier/`; under
`croupier/media/dealers/` ligger Astrid, Vera, Amira och Mei. `source` bevarar
original, `runtime` är spelmedia, `review` är uppladdningar/granskning och
`staging` är arbetsmaterial. `game` och `site` är gemensamma resurser.
Det är filnamnsgrupper i samma Blob, inte separata Vercel-appar eller Render-diskar.

Den gamla roten `astrid/` konsoliderades den 2 oktober: ett äldre zonklipp
flyttades med identisk SHA-256 till `croupier/media/dealers/astrid/source/background-zones/`.
Det lades inte till i det aktiva spelindexet. Tolv äldre `croupier/videos/`
adresser behålls för kompatibilitet med Render-uppladdningsindex/historik;
deras nya runtime-kopior är hashverifierade. Radera inte dessa adresser innan
alla diskreferenser inventerats och migrerats. Historiska QA-kvitton skrivs inte om.

### Vad ligger kvar på Render-diskarna?

**Studio-projekt** betyder sparade presentationsinställningar: val av
dealerklipp, event-/idle-bindningar och regler för när de används. Det är
`studio/project.json` och dess versionshistorik, inte en extra app eller en
samling spelarkonton. "Lab-projekt" syftar här på samma sparade inställningar,
inte ytterligare ett projekt. Lab är arbetsmiljön; Studio är editorn i den.
Ett **Vercel-projekt** är däremot en webbpublicering, ett helt annat begrepp.

| Tjänst | Monterad disk | Kvarvarande ansvar |
| --- | --- | --- |
| Produktion `croupier-v2` | `/var/data`, 5 GB | Studio-projekt, historik, profiler och uppladdnings-/familjeindex; BO-konfiguration; generationer/tal och mediacache; historiska SQLite-filer |
| Isolerad QA `croupier-vercel-preview-qa` | `/var/data`, 1 GB | QA:s separata Studio-/arbetsdata och cache; inte produktionskonton |
| Director `croupier-lab-director` | `/data/catalog`, 1 GB | Katalog, historik och Companion-databas |
| Gateway `croupier-lab-openclaw` | `/data/openclaw`, 1 GB | OpenClaw-konfiguration, agentfiler, sessioner och sökdatabas |

Diskarnas montering/storlek och produktens Blob/Postgres-konfiguration är
kontrollerade live. Innehållstyperna ovan följer sparvägarna och backupkontraktet;
det är inte en fullständig live-fillista. Konton, spelar-ID:n, saldo och rundor
har Neon som aktiv källa. Blob innehåller mediefiler, inte dessa konton.
Render-diskarna behövs därför fortfarande och får inte tömmas. De ersätter
inte en extern verifierad backup; full Studio-/Director-/Gateway-backup återstår.

`croupier-player-preview-qa` bär lagringskopplingar och är ingen dubblett.
Testbackenden `croupier-vercel-preview-qa` startas bara på begäran.
Frontend-Preview kan peka mot produktion; syntetiska konton/rundor kräver
isolerad backend och annat hostname. Game-Neon är aktivt sedan 2 oktober
efter verifierad produktionsimport och separat återläsningsprov. Spelklientens
gränssnitt finns på Vercel och det gemensamma privata Blob-indexet är aktivt.
Bevarade SQLite-filer är historisk rollbackkälla; starta dem aldrig blindt
efter nya PostgreSQL-skrivningar.

`presentation=local` betecknar gemensam presentation även i molnet.
Speluppspelning, Studios observation och genererat tal/video är olika flöden.
Aktiva klippval sparas i samma Studio-projekt. Originalmotorernas exakta
bindningar ligger i `legacyClipPolicy`, Astrids gemensamma spelväg i
`mediaPolicy`/`idlePolicy`. Äldre BO-val bevaras för granskning och explicit
exakt import. BO:s gamla tilldelningsskrivning är avvecklad (HTTP 410).
Nativekvitton visar vad spelet faktiskt presenterat; Partner-SSE är diagnostik.
Vercel visar spel, BO och Lab. Två native Node-funktioner för `/speech-stream`
och `/lipsync-worker` vidarebefordrar WebSocket till Render efter dess autentisering;
gränserna är 300 respektive 600 sekunder. API/SSE, spelmotor och sparade projekt
finns kvar på Render. Lab följer en spelfliks verkliga kvitton utan extra uppspelning.
Privat Blob läses genom servern; frontend får inga modell-/lagringsnycklar.
Zoner använder `CROUPIER_ZONES_DATABASE_URL`, inga generella DB-fallbacks.
Vercels projektkoppling kopierar inte hemligheter till Render.

## Lokal start och sökning

```powershell
node lab/start.mjs --offline --no-open
```

Detta är en tillfällig isolerad preview när start faktiskt är begärd.
`Start-Lab.cmd` använder sparad ansluten profil. Följ
[labbguiden](../lab/docs/README.md), sessionvakten och utskrivna adresser.
Kör ett enda produkt-/labbpar; bevara data och browserutkast.

`.ignore` begränsar vanliga ripgrep-sökningar. Cursor-ignorefilerna utesluter
beroenden, byggcache, binärer och privat lokal data från kontext/index.
De ändrar inte Git-spårning, byggen eller filernas existens. Sök riktat i
källtext och JSON-metadata. Kringgå inte personarkivets läsgräns med
`--no-ignore`, Git-historik eller backup.

## Leverans och kontroll

Registrera filanspråk enligt `agent-talk/README.md`; ta `.git` vid commit.
Före integration/push:

```powershell
node tools/croupier-chef.mjs status
node tools/push-github-work.mjs --check
node tools/push-github-work.mjs
```

Pushhelpern verifierar repo, `main`, fast-forward och matchande remote-SHA.
Ingen force-push, branchradering eller annan destination är tillåten.
Hooks i ny checkout: `git config core.hooksPath .githooks`.
Verifiera GitHub checks och avsedd driftcommit; GPU-image är separat release.
Tester/hashar godkänner inte synk, fysisk mobil/Safari eller backup i drift.

Rena dokumentations-/index-ignore-commits kör snabba env-, GitHub-policy-
och hooktester. Kod, konfiguration, tester och media kör hela regressionen;
CI kör alltid full. Manuell full kontroll: sh .githooks/pre-commit --full.
node tools/precommit-checks.mjs --plan visar valet för aktuellt Git-index.

Källmaterial: pipeline/ innehåller mediebygge och obligatoriska audits.
Tidigare content/, assets/ och Emil-bank är flyttade till gemensam media:
`media/dealers/<dealer>/{runtime,source,review,staging}`, `media/game` och
`media/site`. ID, hash, kalibrering och historisk proveniens bevaras;
`media/layout.json` kopplar exakt gamla paths/URL:er. Licenser och underlag
följer källorna. Nya mappar är ansvar/usage, inte påstått godkänd videokvalitet.
Obsoleta random-stuff-jakob/ och rotens daterade
ANDRINGSLOGG-V2.md är rensade; aktuell status finns i JOHN-HANDOFF.md.
