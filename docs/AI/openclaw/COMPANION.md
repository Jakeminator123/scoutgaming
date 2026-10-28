# Astrids companion: namn, minne, webbsökning och skämtläge

Status: labbfunktion ovanpå [Astrids sociala chatt](SOCIAL-CHAT.md). Admins
Eventstudio, som var dess enda yta, är borttagen (PR #468); Director-delarna och
routerna `/api/social/*` står kvar utan klient tills talkedjan generaliseras
efter O03. Den tas bort med Astrid vid ren start. Webbsökningen är spärrad
sedan 21 oktober 2026, då prisunderlaget i `SEARCH_POLICY.pricingValidUntil`
(`services/openclaw/lab/deploy/companion-search-server.mjs`) gick ut; den
svarar `pricing_review_required` tills priserna granskats och datumet flyttats.

Funktionen ändrar inte spelets `/chat`, partnerportalen, spelregler, media
eller talkön, och ger aldrig åtkomst till spelmotorn.

## Användning

Välj namn (Jakob, Emil, Kevin, Alex eller John; Alexander är alias för Alex).
Samma webbläsarprofil får återkomsthälsning och sparade inlägg. `Berätta om
Emil!` i skämtläge ger ett kort nyskrivet poem på svenska, tyska och kinesiska;
missar modellen formen används ett lokalt fyraradigt original. **Skämtläge**
och **Tillåt webbsökning** stängs av var för sig. **Glöm mig / byt person**
tar bort profilens namn, samtalsminne och svarskvitton. Med **Ljud** läser
ElevenLabs exakt svarstext; talgränsen var 25 sekunder, för långt ljud
avvisades, och ingen ny läppsynk påstods. Beskrivningen gäller den borttagna
Admin-ytan.

## Identitet och lagring

- En slumpad 256-bitars HttpOnly/SameSite=Strict-cookie (30 dagar, path
  `/api/social`) blir via HMAC i namnrymden `croupier-lab-v1` en opak
  profilnyckel. Cookien och nyckeln skickas aldrig till modell eller sök.
- Namnet är ett smeknamn, ingen autentisering; profiler slås aldrig ihop på
  namn. Klientens `playerId`, profilnycklar och historik kan inte välja en
  annan profils minne.
- Director sparar i `LAB_DATA_DIR/companion.json` på sin disk, atomiskt
  ersatt; en skadad fil stoppar funktionen i stället för att nollställa
  kvoten. De senaste 12 inläggen (högst 8 000 tecken) skickas till modellen.
  Profilen gallras efter 30 dagars inaktivitet.
- Request-id, fingeravtryck och svar sparas högst ett dygn för idempotens. Två
  pågående anrop globalt, ett per profil, tio meddelanden per minut och profil.
- ”Glöm mig” raderar applikationsminnet, inte OpenClaws sessionsloggar,
  leverantörens loggar eller säkerhetskopior.
- En framtida produktversion måste härleda identiteten från en verifierad
  session och bolagets serverfält (`(key_id, partner_player) → player_id`) i
  en egen namnrymd. Ingen sådan adapter finns.

## Webbsökning och kostnadstak

Modellen får begära en `search_public_web` per meddelande. Director skickar en
offentlig sökfras (högst 240 tecken) till Gatewayns privata hjälptjänst på
port 18790, som anropar `https://api.openai.com/v1/responses` med låst
`gpt-4.1-mini-2025-04-14`, `web_search`, `max_tool_calls: 1`, 512 ut-token,
låg sökkontext och `store: false`, med `OPENCLAW_MODEL_API_KEY` bara när den
sparade leverantören är OpenAI. Högst tre citerade källor, 256 KB svar och 25
sekunders timeout; ingen omkörning eller reservleverantör. OpenClaw-frågor
begränsas till `docs.openclaw.ai`. Skämtpoem söker aldrig.

Budgeten reserverar 0,50 SEK per försök och högst tio försök per rullande
timme globalt i Gatewayn (`OPENCLAW_STATE_DIR/companion-search.json`); även
misslyckade försök räknas och omstart nollställer inte taket. Director har ett
transporttak på 20 försök per timme. `costSek` är en reservation, inget
fakturabelopp. Chattdata kan inte ändra pris, modell eller budget.

## Kontrakt och avstängning

Director: `POST /api/studio/companion` med `LAB_API_TOKEN` och operationerna
`profile`, `name`, `forget` och `chat`. `identity` kommer från en betrodd
serveradapter; `chat` bär validerad social `input` plus booleska `fun` och
`web`, och extra fält avvisas. Studio: `GET/POST /api/social/profile`, och
`/api/social/chat` kan skicka `companion: { fun, web }`.

Stäng av med exakt `false`:

- `LAB_COMPANION_ENABLED`: hela funktionen (Director och Studio); den vanliga
  sociala chatten finns kvar.
- `LAB_COMPANION_WEB_ENABLED`: all webbsökning i Director; sätt även i Gatewayn
  för att stänga sökhjälpen.
- `LAB_COMPANION_FUN_ENABLED`: skämtpoemen.

Tester: `node --test services/openclaw/lab/test/companion.test.mjs`.
