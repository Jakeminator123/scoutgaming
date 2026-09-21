# Astrids labbprofil, minne, webbsökning och skämtläge

Bygger på V5-källan `94a2688`. Funktionen finns i den befintliga socialchatten
i den lokala studion (`lab/`), för Astrid / idle.ready. Den ändrar inte spelets
`/chat`, Partner-produktionen, spelregler, medier eller Kevins gemensamma talkö.
Labbet kan öppna originalspelet via Partner-launch och observera händelser;
det är fortfarande inte en egen komplett spelklient.

## Användning

Öppna **Chatta med Astrid** och välj Jakob, Emil, Kevin, Alex eller John.
Nästa besök med samma webbläsarprofil och localhost-adress visar återkomsthälsning
och sparade inlägg. Skriv till exempel `Berätta om 'Emil'!` för ett skämtpoem.
Namnen är skiftlägesokänsliga och Alexander är ett alias för Alex. Enbart namnet
eller ett vanligt samtal om personen startar inte skämtläget.

Poemen är nyskrivna, korta, vänligt överdrivna rim på svenska, tyska och kinesiska,
med Jakobs beställda teman. Ulf Lundell kan nämnas, men inga verk kopieras eller
nära efterbildas. Ett svar per meddelande, ingen självchatt eller bakgrundsloop.
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
Director anropar endast DuckDuckGos nyckelfria HTML-sökning på en fast HTTPS-värd.
Ingen betald leverantör, API-nyckel, browser, godtycklig URL-fetch eller automatisk
reservleverantör finns. Sökavgiften är **0 SEK**, alltså under önskade cirka
5 SEK/timme. Modell, hosting och valfritt ljud har separata befintliga kostnader;
detta är inte ett gemensamt kostnadstak för hela OpenClaw-installationen.

Högst 20 sökförsök per rullande 60 minuter gäller för hela Director-instansen.
SQLite reserverar före nätanrop, även fel räknas, och återstart nollställer inte
kvoten. Budgeten kan inte höjas via chatt eller begäransfält. Svar begränsas till
256 KB, åtta sekunders timeout och tre korta källutdrag. Högst två modellkontakter
per meddelande: välj sökning/svara, sedan sammanfatta sökresultat. Inga sökningar
i skämtläge. Källänkar visas separat. Oåtkomlig tjänst, utmaningssida och nådd
timgräns visas uttryckligen; ingen CAPTCHA kringgås och inget söksvar hittas på.

Officiella OpenClaw-källor kontrollerade 2026-09-21:
[webbsökning](https://docs.openclaw.ai/tools/web) och
[DuckDuckGo](https://docs.openclaw.ai/tools/duckduckgo-search).
DuckDuckGos HTML-integration är experimentell och kan blockeras eller ändras.
Vår begränsade adapter kör i Director; vi installerar inte något nytt plugin
och uppgraderar inte den låsta Gateway-versionen 2026.9.5.

## Kontrakt och avstängning

Ny autentiserad Director-route: `POST /api/studio/companion`, med befintlig
`LAB_API_TOKEN`. Operationer: `profile`, `name`, `forget`, `chat`. Den opaka
`identity` kommer från en betrodd serveradapter. Chat innehåller befintlig
validerad social `input`, plus booleska `fun` och `web`. Extra fält avvisas.
Gamla `/api/studio/social-chat` behåller sitt verktygslösa kontrakt och format.
Studio: `GET/POST /api/social/profile`; `/api/social/chat` kan nu skicka
`companion: { fun, web }`. Namn/minne ger aldrig tillgång till spelmotorn.

Alla native agentverktyg, shell, filåtkomst, cron, heartbeat och minnessökning
behåller sina tidigare gränser. Runtimepaket `2026-09-21.1` förklarar de nya
begränsade applikationsåtgärderna för socialrollen. Handtexter och native
inställningar bevaras av befintlig paketsynk med backup och konfliktkontroll.

För att stänga av separat, sätt motsvarande variabel till exakt `false`:

- `LAB_COMPANION_ENABLED`: hela funktionen. Sätt både i Director och lokalt
  `.env`/`lab/.env.local`, starta om båda; gamla socialchatten är kvar.
- `LAB_COMPANION_WEB_ENABLED`: spärrar all ny webbsökning i Director.
- `LAB_COMPANION_FUN_ENABLED`: spärrar specialpoemen i Director.

Talgränsen är `SOCIAL_SPEECH_LIMIT_MS` i `lab/lib/social-playback.mjs` och dess
typdeklaration. En kodrevert av denna leverans återställer även den tidigare
sexsekundersgränsen. Det finns fortsatt bara en talägare och ett ljud åt gången.

Default är på i denna beställda labbfunktion. Ingen miljöhemlighet ändras.
För full kodåterställning: reverta endast feature-committen angiven i
leveranskvittot nedan, pusha arbetsgrenen och driftsätt föregående version på
båda Render-tjänsterna. Gör ingen reset till `94a2688` över senare gemensamt
arbete. Den nya separata SQLite-filen kan ligga kvar avstängd; ta en privat
backup före eventuell filradering. Inga befintliga kataloger eller medier ska
återställas eller raderas. Gamla runtime-snapshots och AGENTS-backuper finns
kvar på Gateway-disken enligt den vanliga runtimepaket-rutinen.

## Leverans och verifiering

Fylls med faktisk commit och driftkvitto efter deployment. Lokala regressioner
täcker separata identiteter, återstart, kvot, idempotens, radering under pågående
anrop, autentisering, sökloopens gräns och befintlig social/TTS-validering.
Mockade tester är inte evidens för levande modellton eller lyckad extern sökning.
