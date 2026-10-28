# Astrids labbchatt och companion (avvecklas)

Status: labbfunktioner bara för Astrid. Admins Eventstudio, deras enda yta, är borttagen (PR #468). Koden står kvar utan klient och tas bort med Astrid vid ren start ([REN-START](../../plans/REN-START.md)). Funktionerna rör aldrig spelets `/chat`, partnerportalen, spelregler, media, talkön eller spelmotorn, och identifierar ingen spelare hos ett bolag.

## Vad som finns i koden

| Del | Källa |
| --- | --- |
| Social chatt: `POST /api/studio/social-chat` på Director (`LAB_API_TOKEN`), bara scenen `{ dealerId: "astrid", eventId: "idle.ready" }`; modellen kan föreslå triggern `social.ledsen` | `packages/director/social.mjs`, roll `croupier-social` i Gatewayn |
| Companion: `POST /api/studio/companion` (`profile`, `name`, `forget`, `chat`), namn, minne och skämtläge | `packages/director/companion*.mjs`, `packages/director/node/companion-store.mjs` (`LAB_DATA_DIR/companion.json`) |
| Webbsökning via Gatewayns privata hjälptjänst (port 18790) | `services/openclaw/lab/deploy/companion-search-server.mjs` |
| Studio-routerna `/api/social`, `/api/social/{chat,profile,status,voice}` | `apps/studio/app/api/social/**`, `apps/studio/lib/social-server.mjs`, `apps/studio/lib/companion-server.mjs`, `apps/studio/policies/social.seed.json`, `apps/studio/schemas/social.schema.json` |
| Prov | `services/openclaw/lab/test/{social,companion}.test.mjs`, `services/openclaw/lab/deploy/companion-search-server.test.mjs`, `apps/studio/test/{social,companion,studio-companion-cookie,studio-social-status}.test.mjs` |

## Gränser som gäller tills koden tas bort

- Modellsvar via `openclaw/croupier-social` med `tool_choice: none`; timeout, saknad konfiguration eller ogiltigt svar ger fel, aldrig en låtsad reservreplik.
- Companion-identiteten är en slumpad HttpOnly-cookie som via HMAC blir en opak profilnyckel; namnet är ett smeknamn, ingen autentisering. "Glöm mig" raderar applikationsminnet, inte OpenClaws eller leverantörens loggar.
- Webbsökningen är spärrad sedan 21 oktober 2026: prisunderlaget i `SEARCH_POLICY.pricingValidUntil` gick ut och tjänsten svarar `pricing_review_required`. Budgettaket ligger i Gatewayns `OPENCLAW_STATE_DIR/companion-search.json`.
- Avstängning med exakt `false`: `LAB_COMPANION_ENABLED` (hela companion), `LAB_COMPANION_WEB_ENABLED` (sökningen, i Director och Gateway), `LAB_COMPANION_FUN_ENABLED` (skämtpoemen). Var de sätts: [variabelregistret](../../ENVIRONMENT-VARIABLES.md).

Den detaljerade beskrivningen av kontrakt, kvoter och användning raderades 28 oktober 2026; den läses med `git show 29ed6626bf:docs/AI/openclaw/COMPANION.md` och `…:docs/AI/openclaw/SOCIAL-CHAT.md`.
