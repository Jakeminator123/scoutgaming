# Astrids sociala labbchatt

Status: labbfunktion i Admins Eventstudio, bara för Astrid. Den tas bort med
Astrid vid ren start.

Chatten är inte operatörschatten, teaminboxen eller spelarens tal i spelet.
Modellen svarar som en fiktiv Astrid och kan föreslå triggern
`social.ledsen`, som väljer Astrids uttryck; det är ingen bedömning av
spelarens tillstånd. Namn, minne och webbsökning ovanpå chatten beskrivs i
[companion](COMPANION.md).

## Kontrakt

`POST /api/studio/social-chat` på Director, med `LAB_API_TOKEN`. Endast scenen
`{ dealerId: "astrid", eventId: "idle.ready" }` tillåts; andra scener avvisas
före modellkontakt. Implementationen är `socialChat(body, settings, fetchImpl)`
i `packages/director/social.mjs`.

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
provider: "responded" }`, där `triggerId` är `social.ledsen` eller `null` och
`confidence` (0–1) är modellens bedömning, ingen kalibrerad sannolikhet.

- Modellen anropas via `openclaw/croupier-social` med `tool_choice: none`,
  512 ut-token och 30 sekunders timeout. `choose_social_response` är ett
  JSON-handlingskontrakt, inget verktyg. Timeout, saknad konfiguration eller
  ogiltigt svar ger fel, aldrig en låtsad reservreplik.
- Vid giltig trigger och `fixed` används exakt den sparade `fixedText`;
  annars skriver modellen svaret. Repliker är högst 500 tecken, normaliserade
  (trim, CRLF/CR → LF, övriga kontrolltecken avvisas).
- Validatorer: `validateSocialPolicy`, `normalizeSocialInput`,
  `validateSocialReply`. Okända fält avvisas. Meddelande högst 1 000 tecken;
  historik högst 12 user/assistant-poster och 8 000 tecken; id 8–100 tecken
  (bokstäver, siffror, `-`, `_`); tröskel 0–1; cooldown 0–300 000 ms.

## Ansvar

- Director: autentisering, validering, högst två samtidiga anrop och tydliga
  modellfel.
- Studio: policylagring, deduplicering, revisionskontroll före och efter
  modell och tal, cooldown, ljud och animation. Ett socialt prov startar bara
  när Astrid väntar; handlingsprov spärras medan det pågår.
- Gateway: egen `croupier-social`-arbetsyta utan verktyg, skills, minnessökning
  eller heartbeat, och en färsk session per anrop. Gatewayn kan ändå logga
  anrop enligt sin konfiguration. Starten lägger additivt till en saknad roll
  och gör konflikter uttryckliga i stället för att skriva över.

Tester: `node --test services/openclaw/lab/test/social.test.mjs` och
deploymenttesterna. De provar kontrakt, transport, fel och rollisolering med
mockar, inte modellens svenska eller motstånd mot varje promptinjektion.
