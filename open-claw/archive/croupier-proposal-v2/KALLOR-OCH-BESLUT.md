# Källor, öppna beslut och skillnader mot originalet

## Källornas rangordning för denna lösning

Bilagans s00–s03 styr begrepp och önskad croupiermodell. Riktiga Partner API-kontrakt och körande kod ska sedan verifieras i implementationssteget. `spelsajt` är en fristående referens, inte en ersättning för den verifieringen. Sajtmaskin bekräftar gateway-/presentationsseparationen, inte casinoimplementationen.

## Skillnader som måste synas

| Fråga | Vad källan säger | Vad detta paket gör |
|---|---|---|
| Antal namn | s00 anger 64 = 29 rng + 35 show; s02 anger/listar 65 = 29 + 36 | Bevarar originalen; räknar inte om tyst eller påstår att allt är synkat |
| Saknad matrisrad | `show.line.peek` finns i s02 men inte i s03:s huvudmatris | Noterar luckan; skapar inte ny runtimehantering |
| Original HTML kontra s03 Markdown | HTML är på vissa ställen kortare om prioritet/fallback | S04 utgår från s03:s fulla spel→session→chatt→tid och hela fallbacktrappan |
| Semantik för eftertrigger | Text/exempel och pseudokod kan tolkas olika om när otur armar comeback | Öppet beslut: trigger sann eller variant faktiskt vald/spelad |
| Samma hashdrag | `r` används för flera val | Domänseparering föreslås som separat möjlig algoritmändring |
| Regelmotorns determinism | s03 väljer efter regler/hash | Råd är valfria, loggas och begränsas; större valfrihet är en ny policy |
| Presentation per rum | Full koordinatorlösning inte specificerad | Föreslår separat single-writer för gemensam dealer; inga take-id:n i spelprotokollet |
| Tidigare serverregel | ”Servern skickar fakta, aldrig take-namn” | Gäller fortfarande spelservern; separat presentationstjänst får egen show-kanal |
| Förlust-/insatsvarianter | Otur, comeback, nära och storinsats föreslås | Bevarar källidéerna men har dem av som förval för pengaspel i väntan på sakgranskning |
| Fria repliker | Sajtmaskin/D-ID kan tala ny text; bilagan har hela takes | Håller isär textchatt, hel inspelning och eventuell separat dynamisk talpipeline |

Ursprungliga bedömningspoäng, personlighetsprocent och antal takes är **källans uppgifter/mål**, inte nya verifierade fakta om ett färdigt system.

## Beslutslogg före implementation

| ID | Behöver avgöras | Föreslaget säkert förval |
|---|---|---|
| D01 | Vilket riktigt repo och vilken aktiv branch gäller? | Ingen kodkoppling förrän C0-kartan verifierats |
| D02 | Delad dealer för hela bordet eller personlig presentation? | En koordinator för delat bord; privata chattar hålls privata |
| D03 | Vilka Astrid-takes finns, har rättigheter och godkänd kalibrering? | Bara kända godkända poster; annars tyst/DOM |
| D04 | Vilken publicerad fakta-gräns får OpenClaw läsa? | Endast redan publicerade fakta för rätt publik |
| D05 | Hur mycket urval får modellen påverka? | Chattförståelse och redan godkända likvärdiga kandidater |
| D06 | När får chatt arma nästa reaktion? | Kort TTL och ny kontroll vid think/watch |
| D07 | Ska AI-röst finnas i v1? | Nej på inspelad video; fri textchatt separat |
| D08 | Vilka triggers får användas i pengaspelsmiljö? | Ingen förlust-/insatsdriven personanpassning utan särskilt beslut |
| D09 | Vilken runtime/modell/budget används? | Separat pinnad instans, inga native verktyg, konservativ kostnadsgräns |
| D10 | Vem godkänner och aktiverar? | Jakob och utsedd systemägare; Kevin-accept enligt originalet |

Inget av dessa öppna beslut hindrar dokumentation, mocktester eller skugglägesdesign. De hindrar däremot att osäkra antaganden blir skarpa rättigheter eller assets.

## Källregister

Referenserna är kontrollerade/lästa den **19 september 2026**. Dokumentationssidor kan ändras; runtimevalet ska därför också versionslåsas vid implementation.

### Bifogat material

**[B1]** `Inklistrad markdown(8).md`: *OpenClaw som fristående agent-gateway — generisk blueprint*. Originalet kopieras i paket 1 till `kallunderlag/openclaw-original-blueprint.md`. Använda avsnitt: 1–4, 6–9, 11–12. Det är användarens referensbeskrivning, inte en säkerhetscertifiering av dagens runtime.

**[B2]** `index.zip`: `README.md`, `s00-helheten.md`, `s01-kartan.md`, `s02-spraket.md`, `s03-motorn.md` och `index.html`. Originalen kopieras i paket 2 till `kallunderlag/`. Används som primär källa för ord, motormodell, landning, assetmodell och ordningen för införande.

### Live GitHub — utvalda filer, läsning utan writes

**[G1]** `Jakeminator123/sajtmaskin`, branch `preview`, commit `63232e7b3e56957a9c96bc258a720f40add7d107`: `infra/openclaw/generate-config.mjs`. Verifierad separat gatewaykonfiguration och tre agent-lanes, inte live tjänstehälsa.
`https://github.com/Jakeminator123/sajtmaskin/blob/63232e7b3e56957a9c96bc258a720f40add7d107/infra/openclaw/generate-config.mjs`

**[G2]** Samma commit: `src/components/avatar/did-openclaw-bridge.tsx`. Verifierad klientkedja: `/api/did/chat` → svarstext → D-ID `speak`.
`https://github.com/Jakeminator123/sajtmaskin/blob/63232e7b3e56957a9c96bc258a720f40add7d107/src/components/avatar/did-openclaw-bridge.tsx`

**[G3]** Samma commit: `src/app/api/did/chat/route.ts`, lästa rader 1–200. Verifierad separat talspråksprompt och historikgränser. Filens blob-SHA: `25646a2b127c17ff77f0eff146ee3fdf9e93b80d`. Inte en full audit av den routen eller anropade hjälpfunktioner.
`https://github.com/Jakeminator123/sajtmaskin/blob/63232e7b3e56957a9c96bc258a720f40add7d107/src/app/api/did/chat/route.ts`

**[G4]** `Jakeminator123/spelsajt`, `main`: `docs/PRESENTATION_AI.md`. Blob-SHA `1dbdfd98563e827951a5c4f8189dad1169f47ffa`. Dokumenterar deterministisk Reaction Planner, valfri AI-förfining och separation från motor/ledger.
`https://github.com/Jakeminator123/spelsajt/blob/main/docs/PRESENTATION_AI.md`

**[G5]** Samma repo/branch: `övrigt/DEALER_AVATAR_SPEC.md`, lästa rader 1–220. Blob-SHA `216187e56c87a98e0acbd40518303de1355a6aa4`. Dokumenterar befintlig/önskad kedja, godkänd GLB och hårda AI-gränser. Detaljer i specifikationen ska inte automatiskt betraktas som implementerade.
`https://github.com/Jakeminator123/spelsajt/blob/main/%C3%B6vrigt/DEALER_AVATAR_SPEC.md`

**[G6]** Samma repo/branch: `README.md`. Blob-SHA `08e3fc4eb7cf1b04095b464bc3af8b03789a9bb5`. Beskriver play-money, monorepot och separat spelserver. Ingen verifiering av skarp drift gjordes.
`https://github.com/Jakeminator123/spelsajt/blob/main/README.md`

### Aktuell officiell teknikdokumentation

| Nyckel | Källa och kontrollerad fråga |
|---|---|
| [W1] | OpenClaw, OpenAI chat completions: operatörsbearer, agent-routing, sessioner och HTTP-ytan. `https://docs.openclaw.ai/gateway/openai-http-api` |
| [W2] | OpenClaw, Tool policy: innehållet i `minimal`, deny-precedens och wildcard. `https://docs.openclaw.ai/gateway/config-tools/tool-policy` |
| [W3] | OpenClaw, Control UI: gateway-hostad UI och WebSocket. `https://docs.openclaw.ai/web/control-ui` |
| [W4] | OpenClaw, Security: en förtroendegräns per gateway. `https://docs.openclaw.ai/gateway/security` |
| [W5] | Render, Persistent Disks: instansbunden disk, deploy-/skalningsbegränsningar och backup. `https://render.com/docs/disks` |
| [W6] | Render, Cron Jobs: UTC-schema och ingen persistent disk. `https://render.com/docs/cronjobs` |
| [W7] | Render, Private Services: ingen publik serviceadress. `https://render.com/docs/private-services` |
| [W8] | Render, Blueprint YAML: `pserv`, Docker och aktuella plan-id:n. `https://render.com/docs/blueprint-spec` |
| [W9] | OpenClaw, Workspace and bootstrap: workspace-filer, skill-gränser och bootstrapsemantik. `https://docs.openclaw.ai/gateway/config-agents/workspace-and-bootstrap` |
| [W10] | OpenClaw, Config RPC: hashbaserad versionskontroll för patch/apply. `https://docs.openclaw.ai/gateway/configuration/config-rpc` |

Referenserna [W] gäller teknikfrågor. Ingen av dem bevisar att just ert kasino har rätt licens, att dess assets är godkända eller att en föreslagen compliancepolicy är tillräcklig.
