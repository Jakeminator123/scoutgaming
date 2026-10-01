# CLI, miljöer och lagring — verifierat 2026-10-01

## Resultat

Render CLI 2.28.0 är direktinstallerad utan Winget/Microsoft Store i
`C:\Users\jakem\AppData\Local\Programs\RenderCLI\render.exe`, med användar-PATH
uppdaterad. Officiell Windows-amd64-release verifierades mot SHA256
`15eae402a24bbcd03c50f6b9283ee34407a090b53a84c3b788bd337eeb978b1d`.
Jakob godkände CLI-inloggningen i Kodex WebView. CLI rapporterade lyckad
inloggning och autentiserad tjänstlistning; aktivt workspace är
`tea-d19jsa63jp1c73ch0sc0`. Token ligger i CLI:s normala privata konfiguration,
inte i repot eller produktens env. SSH är separat: den andra agentens
skrivskyddade försök stoppades vid host-key-verifiering. Ingen SSH-trust ändrades.

Auditen använde läsande Render API med CLI-inloggningen, befintlig Vercel CLI,
källkod och begränsade Neon/Blob-läsningar. Ingen env ändrades/raderades, ingen
databas skrevs och inget GPU-jobb startades av denna audit. Hemligheter
jämfördes i minnet; inga secretvärden eller privata env-exporter finns här.

## Tre aktiva Render-tjänster

| Tjänst | Direkta env | Senast lästa Live-revision | Resultat |
| --- | ---: | --- | --- |
| croupier-v2 | 32 | `f5f3fe2a`, deploy `dep-dav36fg473hc73ac8kc0` | Lissabon, privat Blob, Neonzonanslutning, genererat/strömmat tal och kamera aktiverade; speech-timeout 20000 |
| croupier-lab-director | 15 | `ccdba78e`, deploy `dep-dav32au0tbcc73dciqsg` | adaptive, deep `gpt-6-sol`, speech 20000, generell timeout 8000, privat Gateway-port 18789 |
| croupier-lab-openclaw | 10 | `15bd1541`, deploy `dep-dav28s8u01pc7385ja30` | Terra, OpenAI Responses, vision=1, beständig native config |

Samtliga direkta listor har färre än API-sidgränsen 100. Inga dubbla nycklar,
tomma värden eller omgivande blanksteg hittades. Inga länkade env-grupper
träffade dessa tre tjänster i workspace-listan. En separat gammal
`croupier-vercel-preview-qa` är suspenderad; den är inte produktens ström.

Fyra nödvändiga autentiseringskopplingar är lika över tjänstegränsen:

- Produktens speech-token = Directors speech-token.
- Produktens presentations-token = Directors `LAB_API_TOKEN`.
- Produktens Lab remote-token = Directors `LAB_API_TOKEN`.
- Directors Gateway-token = Gateways Gateway-token.

Produktens tre Director-URL:er pekar på `https://croupier-lab-director.onrender.com`.
Director använder `croupier-lab-openclaw:18789`; ingen gammal BASE_URL-override
finns på den tjänsten. RunPod-endpoint är `zsudl8tmzcmiv1`; dagsgräns 9,94 USD
och sessionsreserv 0,50 USD. Det finns ingen generell nödvändig regel att
kopiera samma env till alla tjänster: de har olika konsumenter och roller.

Detta är sparade env och API-deploystatus. Senaste direkta barnprocess- och
native-rollbevis finns i [routingkvittot](ADAPTIVE-ROUTING-LIVE-2026-10-01.md)
och [Terra-auditen](TERRA-ROUTING-AUDIT-2026-10-01.md). Native rollmodeller
lagras också på disk; env-listan ensam bevisar inte deras effektiva värden.

## Var lagringen faktiskt ligger

| Innehåll | Plats | Verifiering i denna audit |
| --- | --- | --- |
| Nya importerade mediebytes | Privat Vercel Blob `croupier-astrid-zone-media-private`, `store_AqwvebTbBHarOjvG`, region arn1 | Active i Vercel; produktens token listade 12 objekt under `croupier/videos/`, totalt 44 574 024 bytes, ingen nästa sida. Autentiserad HEAD på en MP4 lyckades. |
| Zonkoordinater och zonklippsreferenser | Neon `neondb`, schema `croupier_zones` | Båda tabellerna finns; documents=0 och clips=0. Anslutning med TLS lyckades. |
| Konton, sessioner, spelhistorik och sparat chattminne | SQLite på beständig Render-disk | Källkodens aktuella placering; ingen migrering till Neon gjord här. |
| Familjeregister och äldre diskvarianter | Beständig Render-disk | Tidigare importkvitto: 22 kandidater, 12 Blob + 10 befintliga diskfiler. Inga äldre filer flyttades eller raderades här. |

Blobens observerade host är `aqwvebtbbharojvg.private.blob.vercel-storage.com`.
Vercel anger 13 objekt totalt; vår verifierade medielista omfattar prefixet
`croupier/` och ger 12. Detta är olika listomfång, inte bevis för en saknad fil.
Blob-storen är administrativt kopplad till Vercels QA-projekt, men den riktiga
Render-produkten når samma store med sin befintliga token.

Neon-host är `ep-fragrant-meadow-b1qzb0qv-pooler.c-5.eu-central-1.aws.neon.tech`,
vilket motsvarar databasen i Jakobs skärmbild. Schemat är redo men ännu tomt:
ingen faktisk zonlayout eller zonklippsupload har därmed fått ny liveacceptans.
Användningen kräver inte att Better Auth, Neon Object Storage eller AI Gateway
aktiveras. Vercel Blob är medielagringen i det aktuella kodflödet.

## Vercel: rätt spellänk men överflödig konfiguration

`croupier-frontend` är en Next-landning med root `apps/croupier-frontend`,
rätt GitHub-arbetsbranch och en READY-deployment. 17 env-poster finns, alla
för production+preview, utan överlappande nyckel/scope/branch-dubbletter.
Den enda appägda konsumenten är `CROUPIER_GAME_URL`; dess faktiska värde är
`https://croupier-v2.onrender.com/blackjack?dealer=astrid`. Produktens
`blackjack-entry.mjs` leder efter inloggning till
`/?dealer=astrid&presentation=local`. Denna URL behöver inte ändras till en
annan ström. Ingen hemlighet dekrypterades för denna URL-kontroll.

Följande 16 poster läses inte av den deployade landningens applikationskod:

`CROUPIER_SPEECH_RUNPOD_ENDPOINT_ID`, `BETTALOTTO_API`, `OPENAI_API_KEY`,
`OPENCLAW_PRODUCT_SPEECH_TOKEN`, `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`,
`ELEVENLABS_OC_API`, `BETTALOTTO_PARTNER_KEY_ID`, `BETTALOTTO_PARTNER_SECRET`,
`BETTALOTTO_PARTNER_PLAYER_ID`, `LAB_API_TOKEN`, `CROUPIER_SPEECH_VISION`,
`OPENCLAW_CONFIG_PATH`, `OPENCLAW_DASHBOARD_ORIGIN`, `OPENCLAW_MODEL_API_KEY`,
`OPENCLAWAPI_KEY`.

De är kandidater för en separat rensning, inte saknade Render-inställningar
som automatiskt ska kopieras. Partner/ElevenLabs kan avse äldre eller andra
funktioner. Ingen restorerbar privat backup av alla dessa värden skapades
och inga credentials raderades i den läsande auditen.

`croupier-player-preview-qa` har 36 env-poster, utan överlappande dubbletter:
en Blob-token, 16 särskilda CROUPIER_ZONES-variabler (preview/development),
18 äldre DB/auth-variabler (preview) och GAME_ORIGIN (preview). Den statiska
previewkoden läser endast `CROUPIER_GAME_ORIGIN` vid byggnad. Integrationers
alias är inte 35 extra aktiva applikationsinställningar och ska inte raderas
blint eller kopieras till Render. Previewns backend är suspenderad; detta
projekt är inte den aktiva produktvägen. Dess känslighetsmarkerade origin
dekrypterades inte. Vi verifierade lagring med Render-produktens verkliga
anslutningar i stället för att exportera Vercels databascredentials.

## Lokal miljö och kvarvarande luckor

Den riktiga privata loadern kördes utan att starta några servrar, med explicit
kamera/tal och sedan även molnlagring. Speech-URL/token, remote-token,
Cartesia, Whisper-credential, RunPod-endpoint samt Blob/Neon matchar Render
när respektive funktion är vald. Speech-timeout är 20000.

**Lokal RUNPOD_API_KEY saknas i den effektiva konfigurationen.** Den lokala
talpreviewn är därför inte fullt konfigurerad. Ingen produktionsnyckel
kopierades: en separat lokal relay får inte antas dela Render-processens
budgetjournal. Molnets RunPod-nyckel finns. Repo-rootens `.env` innehåller
ingen RunPod-nyckel eller endpoint; aktuell `emil/` har inga `.env`-filer.
Det finns därför inget belägg här för att den aktuella rootfilen väljer
Emils pod. Arkiverade kopior har inte lästs eller ändrats.

`Start-Lissabon.ps1` pekade på borttagna `lissabon/start.mjs`. Den är rättad
till samma koordinerade `lab/start.mjs` som den fungerande CMD-startaren.
PowerShell-syntax, målfilens existens och `node --check lab/start.mjs`
verifierades med PASS utan serverstart.

Produktens valfria Partner-reference-grupp saknas på Render; den funktionen
är därmed inte konfigurerad. De separata Partner-värdena på Vercel ska inte
kopieras utan att deras avsedda konto och användning verifierats.

Två verkliga strömmade svar, visuell läppsynk och hanteringen av det gamla
RunPod-404-jobbet ägs nu av den andra agentens avgränsade BO-QA. Inga
envändringar/omstarter eller konkurrerande GPU-prov görs av denna audit.
Se även [kodmatrisen](ENV-PLACEMENT-AUDIT-2026-10-01.md).

Källor: [Render CLI](https://render.com/docs/cli),
[officiell release](https://github.com/render-oss/cli/releases/tag/v2.28.0),
[Render env-listans gruppbegränsning](https://api-docs.render.com/reference/get-env-vars-for-service).
