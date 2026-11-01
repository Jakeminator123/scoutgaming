# AI och OpenClaw

Ingång till de AI-dokument som gäller i dag. Kod, promptpaket och maskinlästa
kontrakt ligger vid implementationen; dokumenten här förklarar ansvar och
gränser.

| Behov | Läs här |
| --- | --- |
| Officiella OpenClaw-källor, versionslås och läsregel | [OpenClaw-index](openclaw/README.md) och [källindex](openclaw/OPENCLAW-DOCS.md) |
| Spelarens tal: Director → Gateway → `croupier-speech` | [Produkttal](openclaw/PRODUCT-SPEECH-DEPLOYMENT-SV.md) |
| Director, Gateway, nycklar och Render-drift | [Drift](openclaw/DEPLOYMENT.md) |
| OpenClaws egen dashboard | [Dashboard](openclaw/DASHBOARD-SV.md) |
| Runtimepaketet som Gateway-rollerna får | [Runtime-bundle](../../services/openclaw/lab/deploy/runtime-bundle/README.md) |
| Medier och uppspelning | [Runtime-referensen](../LOCAL-PRESENTATION-RUNTIME.md) |
| Miljövariabler | [Variabelregistret](../ENVIRONMENT-VARIABLES.md) |
| Begrepp | [Ordlistan](../../apps/studio/docs/TERMINOLOGI.md) |
| Läge och nästa steg | [NEXT-AGENT](../NEXT-AGENT.md) |

## Vem anropar vad

| Flöde | Väg | Gräns |
| --- | --- | --- |
| Spelaren talar med dealern | spelmotorn (`croupier-v3`) → Director `croupier-lab-director` `/api/product/speech` → privat Gateway `croupier-lab-openclaw` → `croupier-speech` | Svaret är `recordedLine`, `generatedText` eller `silence`. Kort, sko, saldo och utfall ägs av spelmotorn. |
| Adminroboten (`/studio/api/assistant`) | Vercel → modelladapter i `apps/studio/lib/assistant-*.mjs`; OpenClaw-läget går via Director | Kräver aktuell N1-session. Högst tre paginerade registerläsningar per svar; skrivning bara efter granskning och separat bekräftelse. Ingen fri SQL, shell, signerad URL eller nyckel. |
| Scoutguiden (`/studio/api/public-assistant`) | Vercel → modell, svaret kan läsas upp av D-ID (`speak` med färdig text) | Fast publik sajtinformation. Ingen databas, inga interna verktyg. D-ID:s nyckel stannar på servern. |
| Klippassistenten (`POST /api/dealers/import-proposal`) | Vercel → modell i `apps/studio/lib/dealer-import-model.mjs` | Föreslår klippfack efter klippkartan. Inga verktyg, inga bildrutor, kan inte spara; servern räknar `role` och validerar alternativen. |
| OpenClaws dashboard | Director `/openclaw/` → Gatewayns Control UI → `croupier-operator` | Separat administrativ konversation; styr inte webbchatten. |

Gatewayn har fem roller, inte fem servrar: `croupier-director` (väljer
kompatibel presentationsvariant), `croupier-chat` (förklarar konfiguration),
`croupier-operator` (dashboarden), `croupier-social` (pensionerad labbyta) och
`croupier-speech` (spelarens tal). Repots konfiguration har heartbeat `0m`,
nekade verktyg och avstängd cron och webbläsare, så ingen roll arbetar i
bakgrunden. Effektiv modell per roll ligger i Gatewayns beständiga
`openclaw.json` och kan skilja sig från miljöns standard; läs den innan ett
modellbyte.

## Regler

- Bara `docs.openclaw.ai` och `github.com/openclaw/openclaw` är auktoritativa
  för OpenClaw. Imagen i `services/openclaw/lab/deploy/Dockerfile.gateway`
  uppgraderas inte tyst, och ingen dokumentations-MCP installeras.
- Att ett dokument flyttas eller ändras ger ingen agent nya kunskaper eller
  behörigheter. Gateway-rollerna får bara det versionsmärkta runtimepaketet
  vid containerstart; webbchatten får sitt sammanhang från serveradaptern.
- Ändringar i `packages/director` eller `services/openclaw/lab` når drift först
  när Director respektive Gateway har deployats om.
## Pensionerad labbchatt

Eventstudio, Astrids labbchatts enda produktklient, togs bort i #468.
Kvarvarande social-/companion-routrar och adaptrar är avvecklingskandidater
enligt [REN-START](../plans/REN-START.md), inte ett krav att bevara Astrid.
Spelarens tal använder det separata produkttalkontraktet ovan.
Följ `apps/studio/app/api/social/`, `apps/studio/lib/social-server.mjs` och
`packages/director/{social,companion}.mjs` vid kodavvecklingen. Hjälptjänsten
`services/openclaw/lab/deploy/companion-search-server.mjs` används även av
dashboardinloggning (`services/openclaw/lab/src/studio-admin.mjs`) och
måste bedömas med den konsumenten. Variabelregistret
beskriver kvarvarande avstängningsflaggor; den borttagna labbguidens
historiska detaljkontrakt finns via [HISTORIK](../HISTORIK.md).
