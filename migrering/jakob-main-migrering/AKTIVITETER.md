# Jakobs arbetsström: J01–J10

Tio leveransaktiviteter à 5 procentenheter, sammanlagt 50 procentenheter av hela programmet. [status.json](../status.json) är enda källa för status, beroenden och bevis; checklistorna nedan är krav, inte utförandekvitton. Ingen produktaktivitet blir klar av att denna fil finns.

## Gemensamt uppdrag till underagenten

- Läs [MASTERPLAN](../MASTERPLAN.md), aktuell status, AGENTS och [agent-talk](../../agent-talk/README.md). Orkestratorn ger startbesked efter beroendekontroll och avgränsar filägandet; startfilernas listor är undersökningspunkter, inte generella skrivanspråk.
- Frys aktuell bas och arbets-head. Utgångspunkten är main `15988f32fd572c453d2189502acbe324c4566815`; Jakobs säkerhetsgren behålls. Kevin-källan är `kevin-merge-admin` på `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc`. K01/O01 bestämmer urvalet; `kevin-staging` är endast historik.
- Kontrollera Node/versionspin i berörda paket; använd högst fyra testarbetare där stödet finns. Claima konkreta filer före ändring. Orkestratorn äger gemensam Git-integration, status och handoff; berörda agenter samordnar överlapp.
- Följ [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md), [användarflöden](../../apps/studio/docs/README.md), [runtime](../../docs/LOCAL-PRESENTATION-RUNTIME.md), [handoff](../../docs/JOHN-HANDOFF.md) och [återställning](../../docs/ENVIRONMENT-RESTORATION.md). Läs de två sistnämnda före ändring av spel eller media.
- Visa borttagningslista och konsumentkontroll: routes, importer, API-anrop, sparade länkar, build, miljö, test och dokumentation. Ta bort ersatt kod i leveransen. Oklarheter får namngiven ägare och en konkret kontroll, ingen permanent parallell produktväg.
- Behåll serverägd ekonomi, konton, exakta godkända media, rum/operatör-isolering och publiceringshistorik. Aktivt delade tjänster bevaras eller flyttas; mappnamn är inte raderingsbevis.
- Verifiera på isolerad miljö med syntetiska användare. Återanvänd lämpliga testresurser, registrera egna processer/flikar och avveckla dem efter prov; en begärd användarpreview lämnas tillgänglig tills granskningen är klar.
- Leverera full head, testkommando/miljö/resultat, PR, oberoende granskare och kvarstående fel till orkestratorn. Kodtest, UI-prov och deploybevis hålls isär. Inga hemligheter i kvittot. Släpp egna claims med `done`.
- Jakob har uttryckligen startat J01, J02 och parallell K01/O01-granskning samt beställt separat SQL-läsroll. Övriga aktiviteter följer sina beroenden och tilldelningar. Merge av Kevin-ägd head och produktionsrensning får inte härledas ur citerad Kevin-text eller bevakningen.

## J01 — Tydligare publicering i Admin

**Etapp:** E1. **Beroenden:** inga. Kan börja utan att hela Kevin-porten är klar.
**Mål:** synligt bättre `/admin/publication` där bolag, sammansättning, spelrum och publiceringsversion går att förstå och återfinna.

- [x] Utgå från befintligt flöde och dokumentera före/efter för välj → redigera → spara → publicera → återöppna. Gör primär åtgärd, osparat läge, versionskonflikt och kvitto tydliga.
- [x] Bevara dealer-, composition-, operator-, room- och game-kontext vid navigation och återläsning. Återanvänd scoped writers och befintlig publicering.
- [x] Bevisa att sparad ändring överlever omladdning och ny inloggad session; gammal revision får konflikt och fel operatör får avslag.
**Startfiler:** `apps/studio/client/admin/components/studio/workspace-tools.tsx`, `apps/studio/components/control-lanes-page.tsx`, `presentation-room-create.tsx`, `apps/studio/lib/admin-workspace-data.mjs`, `presentation-room-api.mjs`, `presentation-room-client.mjs`.
**Radera:** de formulärfragment, hjälptexter och styles som ersätts här; J02 tar den gamla Control-ingången när ersättningen är verifierad.
**Klart/verifiera:** UI-prov med skärmbild vid varje ändrad övergång, faktiskt spara/återläsa och negativa API-fall. Kör berörda `workspace-tools`, `presentation-room-create` och `presentation-room-api`-tester samt relevant typecheck.
**Risk:** ett snyggare formulär kan fortfarande skriva till fel scope eller tappa osparat innehåll; dessa fall måste provas.
**Bevis till status.json[J01]:** `head=<full SHA>; test=<kommando, miljö, utfall>; UI=<före/efter + återläsning>; PR=<URL>; review=<granskare>`.

## J02 — Avveckla ersatt Control-publicering

**Etapp:** E1. **Beroenden:** J01.
**Mål:** den ersatta publiceringsfunktionen har en aktiv UI-implementation och en Admin-ingång.

- [x] Kartlägg konsumenter till `/control/rooms`, `/control/companies` och publiceringsdelarna i Control. Flytta aktuella länkar och återhämtningslänkar till rätt Admin-kontext.
- [x] Separera gemensamma tjänster från det pensionerade skalet. Kontrollera särskilt att Admin fortfarande använder delar av `ControlLanesPage`; flytta nyttig kod innan dess gamla fil tas bort.
- [x] Lista berörda bokmärken och deras beslutade destination. En eventuell redirect ska vara explicit och får inte montera den gamla UI-ytan.
**Lokal acceptans:** granskad på `6748838e9194e0554fda060e869785599b890ac4`, [PR317](https://github.com/Jakeminator123/scoutgaming/pull/317). Punkterna ovan, oberoende granskning och [GitHub CI](https://github.com/Jakeminator123/scoutgaming/actions/runs/39630025991) är verifierade på samma head. J02 är VERIFIED. Ingen merge eller produktionsacceptans.

**Startfiler:** `apps/studio/app/control/rooms/page.tsx`, `companies/page.tsx`, `operator-page.tsx`, `apps/studio/components/control-lanes-page.tsx`, `presentation-room-create.tsx`, `packages/navigation/admin-workspace-routes.mjs`.
**Radera:** ersatta Control-routes/komponentdelar, deras exklusiva CSS och tester som enbart låser den gamla publiceringslayouten; ta bort motsvarande build- och dokumentreferenser.
**Klart/verifiera:** noll aktiva konsumenter till de raderade modulerna; J01:s flöde fungerar från Admin och godkända gamla länkar; obehörig åtkomst är fortsatt blockerad. Kör berörda route-, navigations- och publiceringstester samt orphan-kontroll.
**Risk:** en fil med Control-namn kan ägas funktionellt av både Admin och Partner; import- och API-kontroll ska visa faktisk användning.
**Bevis till status.json[J02]:** `head=<SHA>; raderat=<sökvägar + konsumentkontroll>; test=<kommando/resultat>; PR=<URL>; review=<granskare>`.

## J03 — Avveckla resterande Control-ytor

**Etapp:** E2. **Beroenden:** J02, O01.
**Mål:** alla funktioner som ska finnas kvar nås och fungerar i Admin; ingen gammal parallell Control-yta finns kvar.

- [x] Gör en route-matris för återstående Control-sidor: funktion, läsare/skrivare, ny Admin-destination eller uttryckligt borttagande. Ta med verktyg, repliker, klipp, rehearsal och fel-/återhämtningslänkar.
- [x] Flytta inloggning, lösenordssättning, retur-URL, kontext och behörighetskonsumenter. Acceptera gamla lagrade ID:n där kontraktet kräver det utan att behålla det gamla skalet.
- [x] Kontrollera interna navlänkar, assistentens navigationsmål, middleware, basePath, proxy/ingress och output tracing innan routes avregistreras.
**Startfiler:** `apps/studio/app/control/`, `apps/studio/components/control-workspace.tsx`, `apps/studio/lib/ui-server.ts`, `assistant-model.mjs`, `apps/studio/middleware.ts`, `next.config.mjs`, `packages/navigation/control-flow.mjs`.
**Radera:** den gamla Control-workspacen, överflödiga sidwrappers, exklusiva komponenter/styles/tester och förbrukade alias. Delade auth-, registry- och presentationsfunktioner flyttas före radering.
**Klart/verifiera:** 100 % av inventerade routes har verifierat utfall; inloggning/lösenordsflöde, deep links, reload och back/forward fungerar på Admin. Negativa roll- och room-scope-fall passerar. Ingen kvarvarande Control-route renderar en alternativ backoffice-yta.
**Risk:** sökträffar räcker inte för dynamiska retur-URL:er eller serverbyggda länkar; prova dem genom riktiga requestflöden.
**Bevis till status.json[J03]:** `head=<SHA>; routes=<inventering/utfall>; test=<auth + kontext + navigation>; PR=<URL>; review=<granskare>`.

**Parallell delstart 21 oktober:** Jakob har bett oss utföra oberoende arbete medan O01 färdigställs. Guide/Videor startas från J02 6748838e9194e0554fda060e869785599b890ac4 på codex/admin-control-tools-j03. Endast deras gamla SSR-wrappers, callers, GET/HEAD-redirects, exklusiv tracing och berörda tester ingår. Delade komponenter/API:er och auth bevaras. Ingen ny spel-, saldo- eller mediesemantik; därför behövs inget O01-kontrakt för denna del. Hela J03 kräver fortfarande full route-/authacceptans och O01 innan VERIFIED.

**Avgränsad leverans:** [PR318](https://github.com/Jakeminator123/scoutgaming/pull/318), head 314639b54019d02606d7d2e0b1cac19f9c72b24a. Två gamla SSR-wrappers/tracingposter borttagna, callers uppdaterade och redirects verifierade. Implementerarens 108/108 + riktade 44/44 och överlappande commit138/138, 0 skip; Studio-build/typer och orphan530/0 passerar. Oberoende granskning av exakt head: inga blockerande fynd. CI hittade först en gammal testreferens till raderad Control-sida; rättningen passerar 53/53 fokuserade och 21/21 hookprov, 0 skips, samt oberoende deltareview. GitHub CI39641756885 passerar på samma sluthead. Lokalt bygge med återanvända beroenden; fristående deployartefakt/produktion är inte verifierade. Återstående fulla J03-kriterier kvarstår: J03 är IN_PROGRESS, inga nya procentenheter.

**Nästa avgränsade leverans:** [PR320](https://github.com/Jakeminator123/scoutgaming/pull/320), `codex/admin-control-replies-probe-j03` / `db96200a4aa8556c1ff456b70031501407e2935c`, ovanpå PR318. Probe-/Replies-wrappers och exklusiv tracing är borttagna; aktiva länkar/filterhistorik går till befintlig Admin. Gamla dokumentlänkar bevarar kontext, mutationer omdirigeras inte. API/auth/sparning oförändrade. Oberoende granskning utan blockerande fynd; 180/180 hookprov utan skips, 13/13 Replies-komponentprov och 10/10 faktisk Admin-browserhistorik, root15/15 API/query; Studio-build och samtliga frontendtyper gröna. Körningarna överlappar. GitGuardian och CI39646187160 success på oförändrad head; ingen merge/produktion/deployacceptans. Detaljer och lokala byggbegränsningar i status.json[J03].

**Events/Tree levererad:** [PR322](https://github.com/Jakeminator123/scoutgaming/pull/322), `codex/admin-control-events-j03` / `2ea99899228b9574bbf142ae80f3e7a776af0a5b`, ovanpå PR320. Två SSR-wrappers/tracingposter borttagna; Admin äger översikt/editor och historik. Verkligt browserprov hittade och verifierade rättning av gammal projektkopia efter sparning och vybyte. 33/33 fokuserade inklusive 3 browserprov, 202/202 ordinarie hookprov, 0 skips; Studio-build med /studio och alla frontendtyper, orphan531/0 samt oberoende granskning passerar. Route/auth57/57 och riktade konsumentprov passerar; körningarna överlappar. Syntetiska API-svar, lokal build med junctions. GitHub CI39649419165 success på oförändrad head. Ingen merge/deployacceptans; hela J03 är IN_PROGRESS och totalen15%.

**Compositions/Rehearsal levererad:** [PR324](https://github.com/Jakeminator123/scoutgaming/pull/324), codex/admin-control-rehearsal-j03 / 43c0ca8155fdc9f3f8f3b3be22a8d10fd99082ee, ovanpå PR322. Två SSR-wrappers och exklusiv tracing borta; callers/bokmärken går till Admin. Rum/spel når verktygen, tvetydiga rum blockeras och Admin-historik bevarar urval/state med skydd för utkast och pågående anrop. Hook350/350, preview/CAS35/35, faktisk Admin-browser5/5, root auth/room-API72/72 samt riktade konsumentprov,0skip; körningarna överlappar. Studio-build/alla typer, orphan532/0 och oberoende produkt-/testreview gröna. Syntetiska API-svar och avgränsad playback; lokalt junctionbygge, ingen gameplay-/deployacceptans. GitGuardian success på produktheaden. CI39657917855 hittade ett gammalt activity-tvåhoppstest. Rättning i b69f8840d5f7e91ca27224e6d1abce9a50b83cfb ändrar enbart test/handoff och passerar105unika CI-gruppfall över separata lokala körningar, hook27/27,0skip och oberoende deltareview. GitHub CI39661754986 är verifierat success på samma rättningshead. J03 fortsatt IN_PROGRESS,total15%.

**Agentmodeller/Dealerchatt levererad:** [PR326](https://github.com/Jakeminator123/scoutgaming/pull/326), codex/admin-control-ai-j03 / 58133210804b001b6100474bd6833d320c5da3eb från PR324/head43c0ca8155fdc9f3f8f3b3be22a8d10fd99082ee. OpenClaw-/operator-chat-SSR och exklusiv tracing borta; aktiva callers, tab=chat, ops och barealias går till Admin med kontext. Dealerbyte isolerar samtal, navigation skyddar utkast/anrop och sena svar avvisas. Global modell-PATCH/baseHash/fallbacks/kvittoläsning behålls. Ordinarie hook188/188, browser5/5, komponent23/23, root API/auth39/39 och middleware27/27,0skip; route/callerprov och slutlig produkt-/testreview gröna. Studio-build med /studio och alla typer, orphan533/0; syntetiska API-svar och lokala junctions, inga verkliga Gateway-/provider-/spel-/medieanrop. GitGuardian success på produktheaden. CI39661793088 föll på förbrukad direktanropande React-testharness. Enbart test/handoff rättade i ba697260751eb692df09ebe85af6f3ae73489f46;27/27 fokuserade,hook4/4,0skip och rootreview gröna. CI39665285361 är verifierat success på den rättade ba697-headen. Samma activity-testfix som PR324:s uppföljning ingår. Ingen merge/deployacceptans, J03 IN_PROGRESS,total15%.
**Clips levererad:** [PR329](https://github.com/Jakeminator123/scoutgaming/pull/329), codex/admin-control-clips-j03 / b81d858367254a6572a67df02f1a7ee4dcaae585 ovanpå PR326-produkthead5813321. Gamla Clips-SSR, sista exklusiva loader/tracing borttagna; Adminmål bevarar spel, dealer och rå rumskontext. Zoomkartan /admin/clips består. Slutbuild/alla typer/orphan534/0, hook241/241 inklusive7verkliga Admin-browserprov,0skip; oberoende produkt-/testreview utan blockerare. Syntetiska API-svar och isolerade media; lokalt junctionbygge/traces67/44, ingen deployacceptans. Första CI39666861547 föll på gamla testfixturer. Endast test/handoff rättades på ba983288f1e97e26e728e92329425f16125a1dcb; 115/115 fokuserade/hookprov,0skip. Uppföljande CI39673629390 är success på samma rättningshead. Detaljer i status.json[J03].

**Administration levererad:** [PR330](https://github.com/Jakeminator123/scoutgaming/pull/330), `codex/admin-control-administration-j03` / `b60ecf993b609136b32861b0ae433ca769489ba7`, från Clips-produktheadb81d8583 med samma fem testfixar. SSR-wrapper, exklusiv redirecthjälpare och tracing borta. Aktiva callers och GET/HEAD-bokmärken går till rätt Admin-vy med bevarad kontext; mutationer omdirigeras inte. Talgranskning bevarar dealerhistorik, utkast och pågående sparning; 409 behåller utkast. Två implementerare och oberoende produkt-/testreview utan blockerare. 224/224 fokuserade,2/2 faktiska Admin-browserprov och ordinariehook235/235,0skip; överlappande körningar. Studio-build /studio/alla frontendtyper passerar, traces66/44. Syntetiska API/sessioner och isolerade medier, lokal build med junctions; ingen deployacceptans. Uppföljande CI39677936564 är success på rättningshead9627cfa26179038ebd7cba5bc78e8a8061669628 (endast två tester/handoff). O01 är VERIFIED, total20%; J03 fortfarande IN_PROGRESS.
- [x] Guide/Videor: wrappers/callers och CI verifierade i PR318.
- [x] Probe/Replies: wrappers/callers, kontext, authgränser och Admin-historik verifierade lokalt i PR320.
- [x] Probe/Replies: slutlig GitHub CI39646187160 på oförändrad head db96200a4aa8556c1ff456b70031501407e2935c.
- [x] Events/Tree: wrappers/callers, Admin-historik, sparning/återläsning, skydd och lokal build verifierade i PR322.
- [x] Events/Tree: GitHub CI39649419165 success på oförändrad PR322-head2ea99899228b9574bbf142ae80f3e7a776af0a5b.
- [x] Compositions/Rehearsal: wrappers/callers, kontext, sparning/återläsning, historikskydd och lokal build verifierade i PR324.
- [x] Compositions/Rehearsal: CI39657917855:s gamla activity-test rättat och lokalt verifierat i b69f8840d5f7e91ca27224e6d1abce9a50b83cfb.
- [x] Compositions/Rehearsal: GitHub CI39661754986 success på rättningsheadb69f8840d5f7e91ca27224e6d1abce9a50b83cfb.
- [x] Agentmodeller/Dealerchatt: wrappers/callers, kontext, sparning/återläsning, historik-/requestskydd och lokal build verifierade i PR326/head58133210804b001b6100474bd6833d320c5da3eb.
- [x] Agentmodeller/Dealerchatt: Gateway-testharness rättad och lokalt granskad på ba697260751eb692df09ebe85af6f3ae73489f46.
- [x] Agentmodeller/Dealerchatt: GitHub CI39665285361 success på ba697260751eb692df09ebe85af6f3ae73489f46.
- [x] Clips: wrapper/exklusiv loader/callers, kontext och utkastskydd verifierade lokalt i PR329/headb81d858367254a6572a67df02f1a7ee4dcaae585; hook241/241,7browser,0skip,build/typer och oberoende review.
- [x] Clips: CI39673629390 success på rättningsheadba983288f1e97e26e728e92329425f16125a1dcb, färsk PR-head verifierad.
- [x] Administration: lokal produkt-/kontext-/auth-/browser-/buildacceptans och oberoende review i PR330.
- [x] Administration: GitHub CI39677936564 success på rättningshead9627cfa26179038ebd7cba5bc78e8a8061669628; endast två tester/handoff efter produktheadb60.
- [x] Control-root/catch-all och auth: lokala beteendeprov, faktisk browser, slutbuild och oberoende review i PR331/b46e8d1c441fe53572e2d31d38974bbaa77d31a0.
- [ ] Slutlig GitHub CI på PR331-head och samlad J03-acceptans.

Route-matris från J02, uppdaterad genom PR331. Lokal acceptans finns per del ovan och i status.json; sista GitHub CI återstår. Ingen deployacceptans:

| Control-route | Admin-destination | Kvarvarande ansvar |
| --- | --- | --- |
| clips | /admin/dealer-studio | SSR-wrapper och sista exklusiva loader avvecklade i PR329; LabStudio, zoomkarta och projekt-/video-/dealer-API bevaras |
| compositions | /admin/compositions | SSR-wrapper avvecklad i PR324; delad preview/publicering och projekt-CAS bevaras |
| rehearsal | /admin/rehearsal | SSR-wrapper avvecklad i PR324; aktivitet och rumspresentation bevaras |
| events, tree | /admin/events | SSR-wrappers avvecklade i PR322; delad Events/Tree, beslutssimulering och projekt-API bevaras |
| videos, replies, probe, guide | respektive /admin/<route> | SSR-wrappers avvecklade i PR318/320; delade registry-/reply-/projektfunktioner bevaras |
| openclaw, operator-chat | /admin/ai/models, /admin/dealer-agent | SSR-wrappers avvecklade i PR326; tab=chat, kontext och skyddade API:er verifierade |
| administration | tabstyrda Admin-drift/konto/ekonomi/API/media-review | SSR-wrapper/exklusiv redirecthjälpare avvecklade i PR330; NativeAdministration, betalningspanelen och skyddade API:er bevaras |
| root, [[...path]] | /admin och deklarerade verktyg | Control-catch-all/skal borta i PR331; WorkspaceSurfacePage är Partner-only, delad ui-server används av Admin |
| login, set-password | /admin/login, /admin/set-password | Flyttat i PR331; token/returnTo/logout, public origin, basePath, signerade handoffs och host-only cookies verifierade lokalt |

Källor: packages/navigation/admin-workspace-routes.mjs:9, apps/studio/client/admin/components/studio/workspace-tools.tsx:64, apps/studio/lib/next-page-navigation.mjs:15 och apps/studio/next.config.mjs:31. Events/Tree använder efter PR322 Admin-historikägaren; äldre history.replaceState i den kedjan är ersatt. Compositions/Rehearsal använder efter PR324 samma historikägare och explicit rumskontext. Agentmodeller/Dealerchatt använder efter PR326 Adminmål och historikskydd. Clips är avvecklad i PR329 med lokal acceptans och grön CI. Administration är lokalt verifierad och har grön CI i PR330. Auth/root/catch-all är lokalt verifierade och granskade i PR331; slutlig CI återstår.


**Auth och sista skalet levererat:** [PR331](https://github.com/Jakeminator123/scoutgaming/pull/331), `codex/admin-control-auth-j03` / `c7578ede050d21dec3ede098f193fe0276b25027`. Eget delta61filer,+440/-1477. Gamla layouttester har ändrats/raderats. Auth89 unika +12 form/Partner/browserfall över separata slutkörningar (4 faktiska Chrome), shell31/31, middleware27/27,0skip i dessa fokuserade grupper. Ordinariehook185pass/0fail/6 valfria browserskips;4 körda separat ovan,2 oförändrade Replies-fall återanvänder tidigare bevis. Körningar överlappar. Slutbuild /studio/alla frontendtyper och oberoende review utan blockerare. Syntetiska API/sessioner och lokala junctions, ingen live-mail/PG/media/deployacceptans. Fixturer stängda. Authproduktbevis hör till99231001, följt av handoffrättningfd5e6c34. Samlad headb46e8d1c integrerar aktuell main95ac konfliktfritt och bevarar andra agenters ändringar; integrationshook252/252,0skip. CI39680259777 passerade faktiskt Studio-build/alla frontendtyper och isolerad SQL/restart/HTTPS men föll på fyra gamla test-/fixturekrav. Enbart fyra testfiler/handoff rättade i c7578ede: före4/4fel, efter58/58 och normalhook58/58,0skip. Oberoende deltareview utan blockerare. GitGuardian success; CI39682283055 pågår, J03 fortfarande IN_PROGRESS. Total30% genom separat fullacceptans av K02/K03. PR331 är nu den samlade J01/J02/J03-kandidaten.

**Slutacceptans22oktober:** J03 VERIFIED på PR331/head471549a8f02f9165be39c7077afef98f37a67ad0 efter grön samlad CI39684376735. Alla inventerade routes, auth/password, kontext, navigation och negativa scopes har tidigare verifierade utfall; de sista CI-rättningarna ändrar bara förbrukade testförväntningar. Main95ac är integrerad. PR331 är därefter mergad med låst granskad head till main64e4c680a045eb3aed92043032fdbaa35e666359. Oberoende slutreview och grön head-CI/säkerhetscheck återlästa; main-CI39694901249 är completed/success på64e4c680: CI, dealer-regression, lipsync och changes success; doc/moving förväntat skip. Ingen deploy- eller produktionsacceptans.

## J04 — En spelkatalog via lobby

**VERIFIED och mergad 22 oktober:** [PR335](https://github.com/Jakeminator123/scoutgaming/pull/335), granskad head e4df5cba6a2da0bc238f98113db000acd65e62f2. Oberoende j08_ui-/j04_resume-reviewkedja utan blockerare; root läste kod/loggar. Tidigare189/189 hook, fokuserade auth/rum/paket/katalog/konto-prov, verkligt Chrome-flöde och lobby/web tsc gäller. De sista /play→/lobby-testfixarna behåller aktiv auth/identitet/omstart/logout; hook10/10 respektive1/1,0skip. CI39696860730 och GitGuardian success före SHA-kontrollerad merge2026-10-22T00:09:06Z till verifierad main6bcf812eff63fbec99ef0e2c931cfaa8a7e47dad. Inga schema-, beroende- eller produktdelta sedan review; föregående main64e4/CI39694901249 grön, Main-CI39697930664 är completed/success på oförändrad6bcf812eff63fbec99ef0e2c931cfaa8a7e47dad: changes, dealer, lipsync och CI success; doc/moving förväntade skips. Main-GitGuardian-suite är queued utan checkrun, och incident-API-täckning är ofullständig; ingen ny säkerhetsklarering eller deployacceptans. Ruleset24642403 kräver CI,25556822 endast raderingsskydd; vanlig merge efter regelspecifikation och färsk identitet, ingen bypass. PR331/335-kön avslutad; inget nytt automatiskt mergemandat. Primary main orörd, inga grenar raderade eller deploy-/produktionsacceptans.

**Etapp:** E2. **Beroenden:** O01.
**Mål:** `/lobby` är enda katalogingång; `/play/{game}` fortsätter vara det autentiserade launchkontraktet.

- [x] Flytta aktuella kataloglänkar, operator-val och publiceringskvitton till lobby. Ange en tydlig, nåbar hemvist för profil och historik innan äldre sidor tas bort.
- [x] Kartlägg och avveckla `/game` samt gamla `/play`-lobbyn med O01:s beslutade redirect/returutfall; behåll inte en andra spelkatalog.
- [x] Skydda launch med befintlig session, operatör/rum, rätt publicerat paket och aktuell ägarstatus. Klienten får inte sätta saldo eller välja ett obehörigt rum.
**Startfiler:** `apps/studio/client/lobby/`, `apps/studio/app/lobby/[[...path]]/route.ts`, `apps/web/app/game/route.ts`, `apps/web/app/play/`, `apps/web/lib/player-area.mjs`, `player-lobby.mjs`, `server-ui.mjs`, `services/game/player-profile.mjs`.
**Radera:** gamla katalogkomponenter och entrypoints, förbrukade länkar och deras exklusiva layouttester. Behåll kontrakt/tester för aktiva game-launches, profil, historik och serverägd ekonomi.
**Klart/verifiera:** lobby → korrekt rum → launch → tillbaka samt profil/historik fungerar med reload; fel rum, stängt rum, obehörig operatör, saknad session och inaktuellt paket nekas. Kör relevanta `game-entry`, `player-lobby`, `player-area`, `player-profile` och profil-API-tester.
**Risk:** URL-radering kan annars bryta sparade länkar eller av misstag ta bort launchens serverskydd.
**Bevis till status.json[J04]:** `head=<SHA>; routes=<gammal → ny/avvecklad>; test=<flöde + negativa fall>; PR=<URL>; review=<granskare>`.

**Levererade routeutfall:** /play-katalog, /demo, /casino.html och kontextlösa spelalias går till /lobby med bevarade katalogval. Riktiga /play/blackjack och /play/roulette behåller autentiserad launch. Profil/historik finns kvar under /play och nås från lobbyn. Publiceringskvittot går till /lobby. Dubbla/ogiltiga selectors väljer inte ett annat rum; mutationer och next-action omdirigeras inte. Verklig retur från blackjack/roulette, reload och lagrade tillåtna miljöval är rättade och verifierade. Se status.json för full bevismappning.

## J05 — Förenkla runtime och byggkedja

**IN_PROGRESS 22 oktober:** [PR336](https://github.com/Jakeminator123/scoutgaming/pull/336), `codex/shared-room-transport`, head`4dcc3bed0c4e7840a89e54e7a55fc1f30b7268f8` från grön J08/9b43. Läsande kanaladapter9/9, schedulerhealth10/10 och native negativpublicering15/15; normalhook87/87,0skip. Oberoende kevin_plan/j04_resume-review utan blockerare. Det är en förberedelse, inte aktiv listener eller full runtime-/byggförenkling. Senare auth/upgradedelta60/60,0skip med riktig HTTP/ws; GranskadJ08d7 integrerad utan produktavvikelse,12/12normalhook;CI39708474070pågår/GitGuardiangrön.

- [x] Verifiera separat rumskanalport: serverauth/Origin/rumsisolering, publika fält, samtidiga hints, återläsning/version, timeout/buffer och cleanup med syntetiska sockets. Ingen listener/PGnotifiering/klientreplayacceptans.
- [x] Verifiera sanerad skrivfri schedulerhälsa och dokumentera återanvändning av befintlig Renderinstans/start/readiness/drain-gräns.
- [x] Interna validerade sessionsbindningar och faktisk Node-upgradegräns iPR336/a80a80e0: authföre101,Host/Origin/rum,abort/timeout/headbytes/cleanup. Oberoende reviews,normalhook60/60,0skip och riktigloopbackportstängning. Ingen aktiv app/gatewayroute.
- [ ] Koppla room→publiceringsbindning, enskild appdispatcher/gateway/Vercelrouting, K04-version/notifiering samt scheduler till gameboot/readiness utan ny tjänst.

**Etapp:** E2. **Beroenden:** J03, J04.
**Mål:** en begriplig produktkedja utan överflödiga UI-processer, API-proxyer eller alternativa starter.

- [ ] Rita aktuell requestkedja för varje kvarvarande API och mediaström: Vercel/Render → process → tjänst → lagring. Inventera externa och interna konsumenter före runtimebeslut.
- [ ] Utgå från att `ops/cloud/Dockerfile` faktiskt bygger Studio och `ops/cloud/config.mjs` startar dess Next-process. Bestäm vilka kvarvarande API:er som kräver den och flytta dem verifierat före eventuell avveckling.
- [ ] Uppdatera build/start, allowlists, health/version, graceful shutdown och miljökontrakt tillsammans; behåll nödvändiga HTTP/WS- och mediafunktioner.
**Startfiler:** `ops/cloud/Dockerfile`, `start.mjs`, `config.mjs`, `gateway.mjs`, `process-group.mjs`, `ops/cloud/vercel-ingress.mjs`, `packages/server-transport/configuration.mjs`, `apps/studio/start.mjs`, `apps/studio/next.config.mjs`.
**Radera:** bara verifierat ersatta processstarter, byggsteg, proxygrenar, flaggor och deras exklusiva tester/artefakter; förbrukade anslutna lokallägen ska inte återinföras.
**Klart/verifiera:** ren container-/byggkontroll och isolerat start/stop-prov; samtliga inventerade aktiva API:er, WS, auth och media har godkänt utfall. Kör berörda `ops/cloud/test` och transporttester. Redovisa före/efter antal processer och byggvägar utan påhittad prestandavinst.
**Risk:** Studio har serveransvar även när det äldre UI:t är borta; ett grönt frontendbygge bevisar inte att dessa konsumenter fungerar.
**Bevis till status.json[J05]:** `head=<SHA>; API-karta=<referens>; build/start/stop=<miljö/resultat>; PR=<URL>; review=<granskare>`.

## J06 — Rensa testlås och rikta CI

**Etapp:** E2. **Beroenden:** J03, J04, J05.
**Mål:** tester skyddar observerbara beteenden; CI kör rätt kontroller för ändringens risk och håller slutgrinden intakt.

- [ ] Koppla varje berört test till ett aktivt beteende. Ersätt relevanta importer/CSS-/stränglås med interaktions- eller kontraktprov; radera tester för avvecklade funktioner.
- [ ] Föreslå smalare CI-spår med en ändringsmatris för docs, klient, tjänst, schema, delat kontrakt och okänd sökväg; okända/riskbärande ändringar får inte hamna i ett för smalt spår.
- [ ] Bevara nödvändig full regression, typecheck, schema-readiness och säkerhetskontroll. Mät faktisk körningstid före/efter på jämförbar miljö om tidsbesparing rapporteras.
**Startfiler:** `apps/studio/client/admin/lib/workspace-tools.test.mjs`, `apps/studio/test/control-*.test.mjs`, `apps/web/test/`, `tools/ci-changes.mjs`, `precommit-checks.mjs`, `regression-group.mjs`, `.githooks/pre-commit-full`, `.github/workflows/croupier.yml`.
**Radera:** överflödiga assertions, tester och byggjobb med dokumenterad ersättning eller bevisat pensionerat ansvar; inga auth-, ekonomi-, samtidighets- eller spelregressioner tas bort för att bli gröna.
**Klart/verifiera:** testurvalsmatrisen täcker alla riskklasser; ett relevant fel når och fäller slutgrinden, och ett avvecklat UI krävs inte längre. Kör `test/ci-changes.mjs`, `test/precommit-checks.mjs`, `test/github-workflow.mjs` och berörda beteendetester.
**Risk:** en ändringsklassificerare kan missa indirekta kontrakt- eller schemaändringar; testa även blandade diffar och saknad/okänd bas.
**Bevis till status.json[J06]:** `head=<SHA>; urval=<matris>; test=<kommando/resultat>; mätning=<faktisk eller ej utförd>; PR=<URL>; review=<granskare>`.

## J07 — Postgres-adapter för delat bord

**Etapp:** E3. **Beroenden:** K03. Dess kontrakt bygger på K02/O01.
**Mål:** Kevins bordstjänst använder mains Postgres utan egen SQLite-, wallet- eller identitetsprodukt. Jakobs beslut är demo först: J07 binder K03:s walletport till mains serverägda demowallet; gränsen förbereds för en senare aggregatorintegration.

- [x] Implementera O01/K03:s lagringsport med explicit transaktionsgräns, låsordning för bord/rum och berörda spelare, idempotensnycklar och sparad konfigurationsversion.
- [x] Gör insats, demosaldo/reservationer, bord/sko, resultat och journal atomiska inom demoadaptern. Skicka presentationshändelser först för committat utfall; retry, förlorat svar eller omstart får inte ge dubbla ekonomiska effekter.
- [x] Bestäm och prova återstart/recovery och konfliktbeteende med samma kommando-ID samt med ändrad payload. Rum och operatörer får inte dela tillstånd genom fel nyckel.
- [x] Håll walletimplementationen utanför spelkärnan och API-transport utanför koordinatorns spelregler. Behåll extern-wallet-spärren; ingen SQLite-genväg eller tyst demofallback vid extern konfiguration. Dokumentera framtida aggregators idempotens-/status-/återhämtningsgräns utan att bygga en overifierad HTTP-adapter.
- [x] Runtimehealth i PR336/`f34f8e38a6386635958f8610ba39d07beacca35a` verifierad10/10 med oberoende review; ingen bootstrap-/gatewayinkoppling.
- [ ] Isolerad Neonstaging: godkänd PG18/Frankfurt, fast0.25CU/autosuspend300s och cirka24aktivatimmar. En Verceladministrationsväg som kan verifiera inställningarna återstår. Inget projekt/DDL skapat; root återupptar när samma mål/värden kan verifieras.
**Startfiler:** `services/game/postgres-native-table.mjs`, `native-table.mjs`, `storage/postgres-store.mjs`, `packages/storage/server/postgres-store.mjs`, `ops/neon-game/`. Källjämförelse efter K01: `kevin/croupier-scoutgg/server/shared-table.mjs` och `transactions.mjs` på fryst Kevin-SHA.
**Radera:** ersatta SQLite-kopplingar och dubbla wallet-/transaktionsvägar ur den portade produktkedjan; lämna inte en tyst SQLite-fallback.
**Klart/verifiera:** isolerade PostgreSQL-prov med två samtidiga klienter: samma rum, olika rum, samma spelare, dubbelkommando, timeout, rollback och processomstart. Kontrollera exakt saldo/journal, inga dubbla utbetalningar och samma sparade bord efter återläsning.
**Tester:** utgå från `test/postgres-native-table.mjs`, `test/postgres-persistence.mjs` och K03:s adapterkontrakt; lägg bara till beteendeprov för de nya samtidighets- och recoveryfallen.
**Risk:** nuvarande spelarbaserade lås räcker inte automatiskt för ett delat bord; verifiera deadlock/retry och transaktionsägarskap. Krävd schemaversion följer migrations-readiness före merge.
**Bevis till status.json[J07]:** `head=<SHA>; schema=<version>; PG-prov=<isolerad miljö/utfall>; PR=<URL>; review=<granskare>`.

**Isolerad acceptans22oktober:** VERIFIED i [PR332](https://github.com/Jakeminator123/scoutgaming/pull/332), codex/postgres-shared-table-j07/head2dd4e43695acb855dd21b19a674b6ea0d34bb0c0.20/20 verkliga PG-kontrollgrupper med två klienter, processavbrott/PG-omstart och begränsad outboxack;88/88 normal hook,0skip och oberoende slutreview. Schema008/009 endast levererade, ingen produktions-DDL/merge/deploy. Aktiva auth/HTTP/publiceringskopplingar och K04:s beständiga mottagare är ännu inte inkopplade. Se status.json för exakta bevis och gränser.

**J07 tidigare CI-utfall 22 oktober:** senaste PR332-head991ef0c571aef02cd5f475a106da5b010987b6c5 är endast testregistrering/handoff. CI39689146140 startade inga jobb på grund av GitHubs betalning/spendinglimit (jobannotation119530686477). Senare main-CI39694901249 passerade, men det ersätter inte PR332:s egna kontroller. Produktacceptansen på2dd4e43695acb855dd21b19a674b6ea0d34bb0c0 kvarstår; ingen ny PR332-CI-acceptans.

## J08 — Admin styr versionerad spelkonfiguration

- [x] K05-katalogrättning PR334/`d7d139b9f7bf59b1bd924280ab456af12e1c8b5a`: exakt PNGstill utan videoID,frystrevision och canonicaldealerIDsyntax utan registrygrant;20/20adapterAPI,23/23catalogue,12/12hook0skip och oberoende review. CI39708223137pågår/GGgrön,ingen import/aktivering.

- [x] Native kostnadsfri negativdryrun i PR336/`f34f8e38a6386635958f8610ba39d07beacca35a`: båda APIbasvägar, 422fast materialkod, inga delskrivningar/provideranrop och auth/origin före dataread.15/15,0skip och oberoende review. Det verifierar nekad publicering, inte bindning/aktivering.

**Historisk scope-/PG-leverans före nuvarande d7-head:** dåvarande pushad PR334/head9b43e3e7f7cde871cdba9efe81800bf8b5c4d329 är fjärrverifierad med rätt author/source/repo. N1-skyddade room-game-config-utkast, revisions-/rumsskydd, atomiskt package/config-steg och scoped sko-/auditläsning består. Senaste femfilsdelta,+138/-14, binder snapshot/katalog/administrationsrevision till samma scope, frikopplar resolverinput och återkontrollerar aktuella/frysta exakta media och talgodkännande med assertCapturedPresentationMedia före publish på samma SQL-klient. j08_ui före8pass/5fail, efter13/13 API och18/18 med adapter,0skip. Root körde9/9 på riktig PG16.15/Node24.21 mot ändrad produkt och isolerad seed; första seedfelet rättades till befintligt runtimeCatalogJson, ingen produkträttning. Slutlogg: arkiv/2026-10-22/j08/material-snapshot-pg.log. Testport35029/temp-Node/kluster stoppade. j04_resume läste hela femfilsdeltat och API-/adapter-/PG-loggar utan blockerare; root läste. Normal hook13/13,0skip; körningar överlappar. CI39699893800 är completed/success på exakt08736cf37980cfbf6ceee2e3c36b9bb81b3cf04e, GitGuardian119566301138 success. Den gröna CI:n gäller före efterföljande mainintegration. Föregående f079ecd5-CI39698231354 var pågående vid senaste läsningen; inget slutresultat påstås. Verkliga K05-identiteter och native koppling till K04-producenten återstår. Inget provider-I/O, native binder, fallback eller schema-/produktionsaktivering; full J08 är fortsatt IN_PROGRESS. Tidigare isolerade PG-/adapterbevis och testfixar finns versionsmärkta i status.json.

**Etapp:** E4. **Beroenden:** J07, O01.
**Mål:** varje överenskommen spelinställning har en tydlig Admin-kontroll, validerad sparning och bestämd verkan i spelet.

- [x] Integrera main6bcf812eff63fbec99ef0e2c931cfaa8a7e47dad i J08/9b43e3e7 efter oberoende deltareview. Normalhook159pass/0fail/1valfrittbrowserskip. CI39701503691 och GitGuardian119571576203 completed/success på exakt9b43e3e7f7cde871cdba9efe81800bf8b5c4d329; tillämpliga jobb körda. Lokal primary main orörd.
- [x] CI39699893800 verifierad grön på scope-/materialdelen08736cf37980cfbf6ceee2e3c36b9bb81b3cf04e; native-/materialbindning och full J08 kvarstår.
- [ ] Följ O01:s fältmatris: UI-namn → kontraktsfält → scope → validator → writer → publicerad version → spelkonsument → verifiering. Odefinierade fält får beslut före implementation.
- [ ] Pröva Kevins nio kandidater i O01: språk per bord; logga/placering; insatsnivåer; rundtimers; lipsync-worker av/på med nyckelreferenser; RNG shoe-proof-rapport; wallet rollback; dealer → avatarpaket/workerURL; djuplänk dealer/bord. Klassificera varje som accepterad, senare eller avvisad med skäl. Kandidaterna är inte verifierade funktioner eller produktionsmandat.
- [ ] Mappa accepterat urval mot Kevins `dealer`, `room`, `felt`, `lang`, `limit`, `logo`, `layout` och mains talade repliker/idle. O01 bestämmer tillåtna värden, ansvar och verkan per aktiv/ny runda; ingen ny rollback-, worker- eller hemlighetshantering införs genom en UI-kontroll ensam.
- [ ] Bevara skillnaden mellan gemensam mall och `roomOverrides`. Spara med revision, publicera en sammanhängande konfiguration och följ O01:s policy för aktiv hand respektive ny session.
**Startfiler:** `apps/studio/client/admin/components/studio/`, `apps/studio/lib/studio-admin-api.mjs`, `studio-admin-contract.mjs`, `packages/presentation/server/saved-game-policy.mjs`, `packages/presentation/contracts/game-lanes.mjs`. Källjämförelse efter K01: `kevin/croupier-scoutgg/server/studio-tables.mjs`.
**Radera:** ersatta hårdkodade runtimevärden, dubbla formulär/skrivare och Kevin-filregistrets produktkoppling; portera nyttig validering till mains kontrakt.
- [x] Isolerad PG-del:9/9 verkliga prov med två klienter/CAS, SQL-triggerrollback, R-lås, fryst config genom settlement, ny version vid next, proofbytes och fysisk PG-omstart. Cleanup verifierad; logg `arkiv/2026-10-22/j08/pg-verification.log`. Testmaterialplanering och direkta handlers; ingen native HTTP-/K04-/liveacceptans.
- [x] Isolerad materialadapter:5/5 fokusprov, hook39/39, orphan544/0 och oberoende review utan blockerare på dåvarande6ab4cd5e. Ingen native binder eller fallback; senare scope-/revisionsskydd redovisas i nästa delsteg. Verkliga K05-identiteter återstår.
- [x] Scopebundna snapshots och publiceringskontroll på08736cf3: katalog-/administrationsrevision, frikopplade resolverinput samt aktuella/frysta exakta media och talgodkännande kontrolleras före publish på samma klient.13/13 API,18/18 med adapter, faktisk PG9/9 och oberoende review utan blockerare. Verkliga K05-identiteter och native binder ingår inte i denna delacceptans.
**Klart/verifiera:** 100 % av O01:s accepterade fält har spårbarhet och ett giltigt/ogiltigt prov. Spara → återläs → publicera visar samma version; fel roll, fel rum och gammal revision nekas. K06 verifierar spelutfallet och omstart mot dessa kvitton.
**Risk:** sparat JSON bevisar inte att spelet använder värdet; konsument och effektiv version måste ingå i kvittot. Fel mellan mall/rum får inte påverka andra bolag. Hemligheter får inte exponeras i klartext-UI, Git eller Slack; endast godkända referenser används.
**Bevis till status.json[J08]:** `head=<SHA>; fältmatris=<referens>; version=<publiceringsprov>; test=<resultat>; PR=<URL>; review=<granskare>`.

## J09 — Förbered avveckling av oanvända databaskontrakt

**Etapp:** E4. **Beroenden:** J05, J07, J08, K05.
**Mål:** konkret oanvända tabeller/kontrakt har avvecklade konsumenter och en testad, granskbar migrerings- och återställningsordning.

- [ ] Inventera kandidater med samtliga läsare/skrivare, FK/index/views/triggers, bakgrundsjobb, backup/restore och publiceringshistorik. En tom tabell eller ett gammalt namn räcker inte.
- [ ] Avveckla kopplingarna i kod; upprätta exakt migrationsfil och versions-/readinesskrav. Dela expansion, tolerant kod och kontraktion om tidigare release behöver fortsätta fungera.
- [ ] Prova migration från stödd äldre version, avbrutet förlopp och återställning i isolerad Postgres. Jämför radantal/integritet och syntetiska konton, saldon, rättigheter och frysta paket före/efter.
**Startfiler:** `ops/neon-game/product-schema.sql`, `ops/neon-studio/migrations.mjs`, befintliga migrationsfiler, `apps/studio/lib/zone-cloud-schema.sql`, `packages/storage/server/postgres-store.mjs`, `tools/check-migration-readiness.mjs`, `tools/postgres-backup-restore.mjs`.
**Radera:** bevisat förbrukade kodläsare/skrivare, överflödiga fixtures och aktuella kontraktsreferenser. Produktionsradering av tabeller verkställs först i O03 med separat mandat; redan tillämpad migrationshistorik skrivs inte om.
**Klart/verifiera:** konsumentavveckling, migrationsfil, isolerad migration/restore och dokumenterad readiness/ordning är granskade. Kör relevanta migrations-, persistence- och restoretester. Kravet betyder inte att live-tabeller är borttagna eller att redan genomförd Neon/Blob-flytt återöppnas.
**Risk:** kodrollback kan vara inkompatibel med ändrat schema; verifiera återställning mot faktisk release-/schemakombination och bevara skyddad historik/media.
**Bevis till status.json[J09]:** `head=<SHA>; kandidater=<konsumentbevis>; migration/restore=<version, miljö, resultat>; liveDDL=ej utförd i aktiviteten; PR=<URL>; review=<granskare>`.

## J10 — Ren klon, start och återställning

**Etapp:** E5. **Beroenden:** J06, J09, K06. K07 kan gå parallellt med egna resurser; båda möts i O02.
**Mål:** kandidaten kan byggas, startas, återstartas och återställas från dokumenterade ingångar utan ignorerad lokal produktdata.

- [ ] Använd ren klon av fryst kandidat med låsfiler och verifierad Node; kopiera inga lokala databaser, mediaregister, cache/junctions eller hemligheter från arbetscheckouten.
- [ ] Tillför enbart dokumenterad isolerad konfiguration, godkända testresurser och explicit fixturedata. Inventera behov av ignorerad metadata snävt; skydda privata original och .ignore.
- [ ] Kör installation/build/start, ett relevant Admin → publicering → lobby → launch-flöde, omstart och kompatibel rollback/restore. Registrera ägarskap och stäng egna temporära processer/flikar när provet är färdigt.
**Startfiler:** `ops/cloud/Dockerfile`, `ops/cloud/start.mjs`, `apps/studio/start.mjs`, berörda package-/lockfiler, `tools/postgres-backup-restore.mjs`, [återställningsguiden](../../docs/ENVIRONMENT-RESTORATION.md) och [miljöregistret](../../docs/ENVIRONMENT-VARIABLES.md).
**Radera:** kvarvarande bevisat obehövliga byggrester, döda startinstruktioner och produktberoenden till lokala filer; rensa endast uppgiftsägda provresurser. För osäkra privata rester gäller avgränsad återhämtningsbedömning, ingen massrensning.
**Klart/verifiera:** en annan granskare kan upprepa den dokumenterade kedjan från samma SHA; inga dolda lokala läsare eller automatiska produktfallbacks används. Exakta schema-/releasepar för återställning finns. O02 gör oberoende integrerat samprov och O03 verifierar faktisk drift.
**Risk:** en lyckad utvecklarcheckout kan dölja saknade buildfiler eller lokala register; ren klon och separat miljö är beviset. Kvarvarande processer/portar och otestad rollback redovisas uttryckligen.
**Bevis till status.json[J10]:** `head=<SHA>; renklon=<kommando/miljö>; build/start/restart/restore=<utfall>; städning=<verifierat>; PR=<URL>; review=<granskare>`.
