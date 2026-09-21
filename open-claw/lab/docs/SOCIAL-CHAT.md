# Social Astrid – separat labbchatt

Tillägg 2026-09-21: [labbprofil och companion-adapter](COMPANION.md) ger
namnval, avgränsat beständigt minne, en begränsad nyckelfri webbsökning och
skämtpoem. Det använder en ny autentiserad route. Det ursprungliga
`/api/studio/social-chat`-kontraktet nedan är fortsatt stateless/verktygslöst.

Detta är **inte operatörschatten**, IDE-inboxen eller produktionens spelarchatt.
Modellen tolkar vad som skrivs och svarar som en fiktiv Astrid. `social.ledsen`
väljer Astrids uttryck; det är inte en diagnos eller ett påstående om spelarens
psykiska tillstånd. Ingen lokal ordlista låtsas vara OpenClaw.

Endast `{ dealerId: "astrid", eventId: "idle.ready" }` är tillåtet.
`idle.wait` finns inte i nuvarande katalog. Deal och andra scener avvisas före
modellkontakten. Inga nya motor-events, mediefiler eller produktregler skapas.

## Anslutning och kontrakt

`POST /api/studio/social-chat` på Director använder samma `LAB_API_TOKEN` som
övriga labb-API:er. Inga nya nycklar eller extra miljövariabler behövs.
Lokalt finns samma implementation som `socialChat(body, settings, fetchImpl)`
i `src/social.mjs`, för explicit direkt-Gateway-anslutning.

```json
{
  "requestId": "social-request-001",
  "conversationId": "social-session-001",
  "message": "Jag saknar min gamla vän.",
  "history": [],
  "policy": {
    "schemaVersion": 1,
    "revision": "social-policy-001",
    "trigger": {
      "id": "social.ledsen",
      "label": "Ledsen",
      "enabled": true,
      "directive": "Astrid visar medkänsla när samtalet handlar om saknad.",
      "threshold": 0.7
    },
    "response": { "mode": "fixed", "fixedText": "Det gör mig ledsen att höra." },
    "cooldownMs": 8000
  },
  "scene": { "dealerId": "astrid", "eventId": "idle.ready" }
}
```

Svar: `{ requestId, policyRevision, reply, triggerId, confidence,
provider: "responded" }`. `triggerId` är `social.ledsen` eller `null`.
Modellens `confidence` 0–1 är en bedömning, inte en kalibrerad sannolikhet.

`choose_social_response` är ett strikt **JSON-handlingskontrakt**. Det är
inte en installerad native tool eller MCP-funktion. Modellen anropas på riktigt
via `openclaw/croupier-social`, med `tool_choice: none`, 512 outputtokens och
30 sekunders timeout. Endast kontrollerat JSON kan bli ett svar. Vid timeout,
saknad konfiguration eller ogiltigt modellsvar returneras fel, inte en låtsad
framgång eller en lokal reservreplik.

Vid giltig trigger + `fixed` äger policyn repliken: servern använder exakt den
sparade, normaliserade `fixedText`. `free` och otriggerade svar skrivs av modellen.
Text normaliseras med trim och CRLF/CR → LF; LF tillåts som radbrytning men övriga
C0/C1-kontrolltecken avvisas. Repliker är högst 500 tecken. Den lokala adaptern
ska validera svaret igen före animation/TTS och spela just denna text.

Delade rena validatorer: `validateSocialPolicy`, `normalizeSocialInput` och
`validateSocialReply`. Okända fält avvisas. Meddelande max 1 000 tecken; history
max 12 user/assistant-poster och totalt 8 000 tecken. Ingen system-/tool-roll
kan skickas in som historik. Request/conversation-ID: 8–100 bokstäver, siffror,
bindestreck eller understreck. Policyrevision max 100 tecken, tröskel 0–1,
cooldown heltal 0–300 000 ms. Directive max 1 000 tecken.

## Vad äger vilken del?

- Director: autentisering, input-/outputvalidering, två samtidiga sociala
  anrop, faktisk OpenClaw-kontakt och tydliga modellfel.
- Lokal studio: policylagring, request-dedupe, kontroll av policyrevision före
  och efter modell/TTS, cooldown, ljud och animation. Director lagrar inte
  policyn och kan inte bevisa att klientens scen eller cooldown är aktuell.
- Gateway: separat `croupier-social`-arbetsyta, modell och anropssession.
  Varje anrop får en färsk sessionsnyckel även om requestId upprepas. Endast
  explicit inskickad bounded history förs vidare till nästa anrop; detta bygger
  ingen långvarig spelarprofil. Gateway kan fortfarande spara anropslogg/session
  enligt sin vanliga konfiguration; detta är inget löfte om loggfri drift.

## Befintlig persistent Gateway

Nästa start lägger additivt till en saknad `croupier-social`, återanvänder den
befintliga chattmodellens referens och sparar `openclaw.json.pre-social-migration.bak`.
Övriga agenter, modellinställningar och handtexter bevaras. Socialrollen har inga
verktyg, skills, aktiv minnessökning eller heartbeat. En befintlig socialroll med
egna namn/modell bevaras; delad arbetsyta/state eller aktiverade verktyg/minne
blir en uttrycklig konflikt, inte en tyst överskrivning.

Runtimepaket `2026-09-20.2` injicerar rollens lilla kontrakt via managed AGENTS
och kompletterar operatörens begreppsindex. Inga nya operatorverktyg ges.

Tester: `node --test open-claw/lab/test/social.test.mjs` och deployment-testerna.
Mockade tester verifierar kontrakt, transport, fel och rollisolering – inte en
levande modells svenska, semantiska träffsäkerhet eller motstånd mot varje
prompt-injektion. Efter deploy behövs ett verkligt, litet positivt/negativt prov.
