# Astrids labbprofil, minne, webbsökning och skämtläge

> Guide flyttad 2026-10-13. Relativa kodsökvägar som `src/`, `deploy/` och
> `config/` i exemplen utgår från `services/openclaw/lab/`. Daterade prov nedan
> är historiska; [aktuell dokumentingång](../README.md) skiljer drift från förslag.

Funktionen finns i den befintliga socialchatten
i den lokala studion (`lab/`), för Astrid / idle.ready. Den ändrar inte spelets
`/chat`, Partner-produktionen, spelregler, medier eller Kevins gemensamma talkö.
Labbet kan öppna originalspelet via Partner-launch och observera händelser;
det är fortfarande inte en egen komplett spelklient.

## Användning

Öppna **Chatta med Astrid** och välj Jakob, Emil, Kevin, Alex eller John.
Nästa besök med samma webbläsarprofil och localhost-adress visar återkomsthälsning
och sparade inlägg. Skriv till exempel `Berätta om 'Emil'!` för ett skämtpoem.
Namnen är skiftlägesokänsliga och Alexander är ett alias för Alex. Enbart namnet
ensamt startar inte skämtläget. Även `Vem är Jakob?` och `Berätta om Jakob.
Vad gör han?` fungerar. Båda labbchattarna får samma fiktiva personbeskrivningar
för namnfrågor och följdfrågor. Operatörschatten får inte spelarens privata minne.

Poemen är nyskrivna, korta, vänligt överdrivna rim på svenska, tyska och kinesiska,
med Jakobs beställda teman. Ulf Lundell kan nämnas, men inga verk kopieras eller
nära efterbildas. Om modellen missar fyra rader eller språkblandningen ersätts
svaret av ett lokalt fyraradigt original för namnet. Ett svar per meddelande,
ingen självchatt eller bakgrundsloop.
På Jakobs uttryckliga begäran är labbets talgräns nu **25 sekunder**, även för
poemen. Med Ljud på skickas exakt svarstext till befintligt ElevenLabs-prov;
avmarkera för enbart text. Modellen ombeds hålla dikten kort, men faktisk
ljudlängd kontrolleras före start och med tidsvakt. För långa ljud avvisas utan
automatisk omgenerering. Befintlig neutral idle används; ingen ny läppsynk påstås.

**Skämtläge** och **Tillåt webbsökning** kan avmarkeras oberoende. **Glöm mig /
byt person** tar bort profilens namn, samtalsminne och sparade svarkvitton, och
låter nästa person välja namn. Namnbyte återanvänder inte någon annans historik.

## Identitet och lagring

- Lokal server sätter en slumpad 256-bitars HttpOnly/SameSite=Strict-cookie,
  med 30 dagars livslängd och path `/api/social`. HMAC med serverns befintliga
  anslutningshemlighet och separat `croupier-lab-v1`-namnrymd blir en opak profilnyckel.
  Cookien eller nyckeln skickas aldrig till modellen eller söktjänsten.
- Ett namn är ett valt smeknamn, inte autentisering. Två webbläsare som väljer
  Jakob delar inte minne. Browser-`playerId`, godtyckliga profilnycklar och
  inskickad klienthistorik kan inte välja en annan profils minne.
- Director sparar endast denna funktion i `LAB_DATA_DIR/companion.sqlite`
  på sin befintliga Render-disk (lokal direkt-Gateway: `dataDir/companion/`).
  De senaste 12 user/assistant-inläggen, maximalt 8 000 tecken, förs till modellen.
  Profilen gallras vid användning efter 30 dagar utan namnändring/chatt.
  Det är avgränsad samtalshistorik, inte obegränsat långtidsminne eller embeddings.
- Request-ID, fingeravtryck och svar sparas i högst ett dygn för idempotens.
  Dubbelklick/återstart får inte orsaka samma modellanrop på nytt. Två pågående
  anrop globalt, ett per profil och tio nya meddelanden/minut/profil.
  Glöm/namnändring byter revision; sena svar kan inte återskapa borttaget minne.
- ”Glöm mig” raderar applikationsminnet. OpenClaws normala sessionsloggar,
  modellleverantörens loggar och eventuella befintliga säkerhetskopior har separat
  retention; knappen lovar inte att fjärrloggar eller backuper raderas.
- Rensade cookies, annan localhost-adress eller roterad anslutningshemlighet
  ger en ny labbidentitet. Inga profiler slås ihop utifrån namn.

Partner-flödet har redan servermappningen `(key_id, partner_player) → player_id`.
En framtida produktadapter måste härleda identiteten från en verifierad session
och dessa serverfält, med en separat tenant/Partner-namnrymd. Labbets observerade
ström och `LAB_PARTNER_PLAYER_ID` är inte bevis på besökarens identitet och används
därför inte för att öppna någon spelares minne. Den adaptern är inte driftsatt här.

## Sökning och kostnadsgräns

Modellen får begära en enda `search_public_web`-applikationsåtgärd per meddelande.
Efter anslutningsfel mot DuckDuckGo från Render valde Jakob uttryckligen den
befintliga OpenAI-anslutningen, högst cirka 5 SEK/timme. Gratisadaptern är borttagen.
Director skickar en offentlig sökfras till Gatewayns privata hjälptjänst på
port 18790. Den använder befintlig `OPENCLAW_MODEL_API_KEY` endast när den sparade
leverantören är OpenAI. Inga nycklar kopieras till Director eller webbläsaren.
Gatewayns vanliga port 18789, native verktyg och dashboard ändras inte.

Hjälptjänsten anropar enbart `https://api.openai.com/v1/responses`, med låst
`gpt-4.1-mini-2025-04-14`, standardprissättning, `web_search`, `max_tool_calls: 1`,
512 ut-token, låg sökkontext och `store: false`. Frasen är högst 240 tecken;
personminne, profilnycklar och katalog skickas inte. Högst tre citerade HTTP(S)-
källor återförs. OpenClaw-frågor begränsas till `docs.openclaw.ai` efter att ett
liveprov hittade en orelaterad sida med missvisande titel. Högst 256 KB API-svar,
25 sekunders timeout och ingen automatisk
omkörning eller reservleverantör. Director gör högst två vanliga modellkontakter
för att välja sökning och sammanfatta resultatet. Skämtpoem söker inte på webben.

Budgeten reserverar **0,50 SEK per försök, högst tio försök per rullande timme**,
globalt på Gateway. `OPENCLAW_STATE_DIR/companion-search.sqlite` lagrar reservationer
och idempotenta kvitton; även misslyckade/avbrutna försök räknas, och omstart
nollställer inte taket. Director har därutöver ett transporttak på 20 försök/timme.
Varken pris, modell, verktygsantal eller budget kan ändras av chattdata.
`costSek` är en konservativ reservation, inte uppmätt fakturabelopp.

Prisunderlag kontrollerat 2026-09-21: 0,01 USD/sökanrop, 8 000 fasta sökindatatoken
plus den korta frågan, 0,40 USD/miljon in-token och 1,60 USD/miljon ut-token.
Reservationen använder 20 SEK/USD samt marginal för moms. Med dessa priser ligger
den begränsade sökningen under reservationen. Prisantagandet spärras automatiskt
2026-10-21 tills `SEARCH_POLICY` har granskats igen. Taket avser söktjänsten,
inklusive dess modell; vanlig chatt, hosting och ElevenLabs har separata kostnader.

Primärkällor: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search),
[priser](https://developers.openai.com/api/docs/pricing),
[max_tool_calls](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
och [Render privata tjänster](https://render.com/docs/private-services).
OpenClaw ligger kvar på låsta versionen 2026.9.5. Ingen ny MCP/plugin installeras.

## Kontrakt och avstängning

Ny autentiserad Director-route: `POST /api/studio/companion`, med befintlig
`LAB_API_TOKEN`. Operationer: `profile`, `name`, `forget`, `chat`. Den opaka
`identity` kommer från en betrodd serveradapter. Chat innehåller befintlig
validerad social `input`, plus booleska `fun` och `web`. Extra fält avvisas.
Gamla `/api/studio/social-chat` behåller sitt verktygslösa kontrakt och format.
Studio: `GET/POST /api/social/profile`; `/api/social/chat` kan nu skicka
`companion: { fun, web }`. Namn/minne ger aldrig tillgång till spelmotorn.

Alla native agentverktyg, shell, filåtkomst, cron, heartbeat och minnessökning
behåller sina tidigare gränser. Runtimepaket `2026-09-21.2` förklarar de nya
begränsade applikationsåtgärderna för socialrollen. Handtexter och native
inställningar bevaras av befintlig paketsynk med backup och konfliktkontroll.

För att stänga av separat, sätt motsvarande variabel till exakt `false`:

- `LAB_COMPANION_ENABLED`: hela funktionen. Sätt både i Director och lokalt
  `.env`/`lab/.env.local`, starta om båda; gamla socialchatten är kvar.
- `LAB_COMPANION_WEB_ENABLED`: spärrar all ny webbsökning i Director; sätt även
  på Gateway för att stänga dess privata sökhjälp efter omstart.
- `LAB_COMPANION_FUN_ENABLED`: spärrar specialpoemen i Director.

Talgränsen är `SOCIAL_SPEECH_LIMIT_MS` i `lab/lib/social-playback.mjs` och dess
typdeklaration. En kodrevert av denna leverans återställer även den tidigare
sexsekundersgränsen. Det finns fortsatt bara en talägare och ett ljud åt gången.

## Aktuell drift och ändringar

Funktionskontraktet ovan gäller den separata labbprofilen. Det är inte
spelets inloggning, saldo eller en färdig Neon-migrering. Äldre
funktionscommittar och driftprov finns i Git-historiken; deras manuella
revert- och pushinstruktioner hör inte till dagens arbetsflöde.

Leverera granskade ändringar till `Jakeminator123/scoutgaming` från en
featurebranch under `jakob/*`, `codex/*` eller `cursor/*`. Pusha med
`node tools/push-github-work.mjs` och öppna en PR till `main`; merge kräver
gröna kontroller och gällande godkännande enligt [AGENTS.md](../../../AGENTS.md).
Förvalta befintliga Render-tjänster enligt [driftguiden](RENDER-START-SV.md).
Aktuella kontroller och kvarvarande verifiering finns i
[driften](DEPLOYMENT.md) och [molnkartan](../../CLOUD-MIGRATION.md).
