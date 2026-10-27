# Produkttal: rollen `croupier-speech` och privat transport

Spelarens samtal med dealern går från spelmotorn via Director till en egen,
verktygslös Gateway-roll. Kodkontraktet nedan gäller; driften står i
[DEPLOYMENT](DEPLOYMENT.md). Konfiguration är inget bevis för fungerande
tal, bild eller läppsynk; det bedömer Jakob.

## Transport

```text
spelmotorn croupier-v3 (services/game/openclaw-chat.mjs)
  -- HTTPS + separat produkt-speech bearer --> Director POST /api/product/speech
  -- privat Render-nät + Gateway-hemlighet --> Gateway /v1/chat/completions
  -- model: openclaw/croupier-speech
```

- Webbläsaren anropar spelmotorns `POST /chat`; den får aldrig någon
  hemlighet och anropar aldrig Director direkt.
- Spelmotorn har bara `OPENCLAW_PRODUCT_SPEECH_URL` (Directors HTTPS-origin),
  `OPENCLAW_PRODUCT_SPEECH_TOKEN` och `OPENCLAW_SPEECH_AGENT` (standard
  `openclaw/croupier-speech`), aldrig `OPENCLAW_API_KEY`.
  `OPENCLAW_CHAT_AGENT` är operatörschatten och används inte här.
- Director-endpointen tar bara `POST application/json`, högst 256 KiB, och
  det fullständiga validerade kontraktet. Den deduplicerar på request-id
  inom processen, avvisar ändrat innehåll under samma id, kör högst två
  modellval samtidigt och har servertimeout och svarstak.
- Produkt-token måste skilja sig från `LAB_API_TOKEN`; koden vägrar samma
  värde. Produkt-token godkänns inte på `/api/status`, katalog, studio,
  social eller operatör, och labbtoken godkänns inte på produktendpointen.
  Director använder sedan sin egen `OPENCLAW_API_KEY` mot Gatewayn.
- Bearern autentiserar en betrodd process, inte en spelare. Det som hindrar
  en klient från att byta spelare, dealer, kort eller talpolicy är spelmotorns
  serverägda session och revision och den stängda projektionen.
- Gatewayns `/v1` ger full operatörsåtkomst och ska bara nås via privat nät.
  Directors publika `/openclaw/`-proxy vidarebefordrar aldrig `/v1`.

## Kontrakt

Spelmotorn skickar en allowlistad projektion: request-id, dealer-id, session-
och rundrevision, säkert visningsnamn, publicerade händelser, synliga kort och
summor, box- och handindex samt sluten talpolicy. Spelar-id, cookie, saldo,
kommande kort i skon, bränt kort och dolt hålkort ingår aldrig.

Svaret är exakt ett av `recordedLine`, `generatedText` eller `silence` och
ekar alla fyra identitets- och revisionsfält. Director och spelmotorn
validerar båda. Spelmotorns posegrind släpper chattrad och tal först vid en
verkligt presenterad `standard-idle` och använder den enda talkön. OpenClaw
kan inte ange timing, `playNow`, media, animation eller köordning, och ett
väntande svar blockerar aldrig deal, hit, double eller dealerns kort.

## Gateway-rollen

`croupier-speech` har egen `workspace` och `agentDir`, samma
`model.primary` som `croupier-chat`, tom `fallbacks` och `skills`, avstängd
minnessökning och heartbeat (`0m`), `tools.profile=minimal`,
`tools.deny=["*"]` och avstängd elevated. Gateway-starten lägger additivt till
en saknad roll (`reconcile-speech` / `reconcile-roles`) och skriver aldrig över
en konflikterande handredigerad roll. Fälten finns i den taggade versionens
schema ([AgentEntry](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/config/zod-schema.agent-runtime.ts),
[agents](https://github.com/openclaw/openclaw/blob/v2026.9.5/src/config/zod-schema.agents.ts),
[HTTP-API](https://github.com/openclaw/openclaw/blob/v2026.9.5/docs/gateway/openai-http-api.md)
med `model: openclaw/<agentId>`, `tool_choice: "none"` och
`max_completion_tokens`).

Kontroll efter Gateway-deploy, i containern: `node /app/openclaw.mjs --version`
matchar Dockerfilen, `config validate --json` är grön och rollen har fälten
ovan. Efter Director-deploy: status med labbtoken annonserar
`product-speech-v1`, produkt-token får 401 på `/api/status` och labbtoken 401
på `/api/product/speech`. Återställning: ta bort spelmotorns speech-URL och
token och deploya om spelmotorn; övriga roller lämnas orörda.

## Dealerpersona

Persona och svarsspråk kommer från
[dealer-chat-persona.mjs](../../../packages/presentation/contracts/dealer-chat-persona.mjs):
dealer-id → `displayName`, `language` (`sv`/`en`), kort `persona` och
`replyStyle` (högst två meningar, 220 tecken). `packages/director/product-speech.mjs`
lägger persona, språkregel och den gemensamma gränsen (inga spelråd,
oddslöften eller uppmaningar att spela) efter adapterns spel-, integritets-
och JSON-regler. Paow och Dragan svarar på svenska, Astrid på engelska, och en
oregistrerad dealer får den generiska prompten. Svarsbiblioteket sparar
dealerns registrerade språk (annars `en`). Ny dealer: lägg en post i registret
och ett fall i `services/openclaw/lab/test/dealer-chat-persona.test.mjs`.
Prompten byggs i Director, så ändringen når spelet först efter Director-deploy.

## Tester

```powershell
node --test test/openclaw-chat-contract.mjs test/chat-decision-player.mjs test/speech-package-contract.mjs test/speech-pose-gate.mjs
node --test services/openclaw/lab/test/product-speech.test.mjs services/openclaw/lab/deploy/gateway-config.test.mjs services/openclaw/lab/deploy/runtime-bundle.test.mjs services/openclaw/lab/deploy/start-gateway.test.mjs
node tools/run-engine-qa.mjs --postgres-bin <bin> test/product-chat-http.mjs
```

Testerna använder fixturehemligheter, HTTP-stubbar, loopback och tempdata och
gör inga modell- eller molnanrop. `test/product-chat-http.mjs` kör spelmotorn
mot Postgres och hoppar över med skäl utan motorharnessen.
