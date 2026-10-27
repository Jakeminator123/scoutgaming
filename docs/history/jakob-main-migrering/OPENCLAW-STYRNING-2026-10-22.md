# OpenClaw: vad styr det, var ställs det in, vad saknas för dealer-temperament

Läsrapport 2026-10-22 på main `7afae426`. Underlag är kodläsning: inga körningar, inga nätanrop, inga `.env`-filer.
Det som bara finns live (Render-env, Gatewayns `openclaw.json`, dashboardens rättigheter) är märkt "ej verifierat".
Sökvägar är från repots rot. "Klipp" = en videotagning i dealerns bibliotek (TERMINOLOGI). Replik/tal = talad text med exakt ljud och bild.

## 1. Kedjan

### 1a. Spelare, chatt, OpenClaw, svar, klipp

```
Spelaren skriver   services/game/public/app.mjs:1820-1833 (observeChat + POST /chat)
 -> services/game/server.mjs:1100        authorizeChatDealer (registered-chat-context.mjs:22): publicerat rum + dealer
 -> authoritativeChatStatus (server.mjs:573)   allowedSpeech = {recordedLines: [], generatedText: true, silence: true} (server.mjs:569-571)
 -> completeChatWithSpeech (generated-speech-chat.mjs:3) -> openClawChat (openclaw-chat.mjs:215), projektion :125-170
 -> relay till Director /api/product/speech (services/openclaw/lab/src/server.mjs:184; product-speech.mjs:288)
 -> Gateway-rollen croupier-speech svarar med JSON, appen validerar (openclaw-chat.mjs:186-211)
 -> text blir genererat tal + läppsynk ur dealerns referens (generated-speech-chat.mjs:22-31), annars bara text
 -> klient: readChatResponse (chat-response.mjs:12) -> speech-pose-gate (väntar på standard-idle) -> chat-decision-player.mjs:3,25
```

OpenClaw väljer alltså ord eller tystnad i chatten, inte klipp. Klipp väljs i två andra anrop (idle-råd, spelhändelse) av en annan roll (`croupier-director`).

### 1b. Beslut OpenClaw fattar

| Beslut | Roll och modell | Utfall | Kan det välja klipp? | Fil:rad |
| --- | --- | --- | --- | --- |
| Chattsvar | `croupier-speech`; Astrid: `probePolicy.model`, övriga rollens primärmodell | text (max 500 tecken) eller tystnad | Nej. Texten blir genererat tal. `recordedLine` finns i kontraktet men är stängt (`recordedLines: []`) | server.mjs:569; product-speech.mjs:168-184 |
| Replikkategori `speak.*` | Motorn | OpenClaw skapar ingen `speak`-händelse; motorns `publishedEvents` är bara kontext | Director kan välja mellan tagningar (varianter) av en `speak`-plats | openclaw-chat.mjs:64-67; selection.mjs:25 |
| Klippval vid spelhändelse (speak, deal, reveal) | `croupier-director` | ett `variantId` ur eligible-listan, annars standard | Ja, men bara varianter Admin släppt till OpenClaw (`selection.model`) och som passar händelsen | selection.mjs:16-23,79-89; engine.mjs:296-322 |
| Idle-råd (beteendeklipp i Vila) | `croupier-director` | ett beteendeklipp eller avstå, efter att spelaren chattat | Ja, bland `idlePolicy.variants` med `use: 'openclaw'`; underlag är spelarens senaste rad (max 600 tecken) | idle-advice.mjs:55-113,126-197; local-presentation.mjs:99-124 |
| Eskalering | samma roll, andra passet `gpt-6-sol` | högst ett extra pass när första svaret är `kind: escalate` | Nej | speech-routing.mjs:8-32; product-speech.mjs:233-275 |
| Probe (eget tal vid inaktivitet) | `croupier-speech`, `probePolicy.model` | en mening (max 240 tecken) eller tystnad | Nej | product-probe.mjs:54-126 |
| Social labbchatt | `croupier-social` | text plus uttrycket `social.ledsen` eller inget | Bara Ledsen/neutral; produktens spelare använder den inte (ingen träff i `services/game`) | social.mjs:60-122 |

### 1c. Vilka klipp, och var valet begränsas

| Väg | Kandidatmängd (vem sätter den) | Begränsning utanför modellen | Fil:rad |
| --- | --- | --- | --- |
| Spelhändelse | Variantens `selection.model` plus baseline, filtrerat på video som finns och passar exakt händelse | Gate: ogiltigt svar, `ineligible_variant`, `abstained`, `shadow_only` ger standard. Filmad utdelning går förbi OpenClaw. `turn` och `settle` väljer inget klipp | selection.mjs:56-69; engine.mjs:302-311; presentation-api.mjs:208-224 |
| Idle-råd | Dealerns egna beteendeklipp markerade `use: 'openclaw'`; etikett = filnamn + beskrivning (max 80 tecken) | Klient: ett råd-start per minut, samma klipp tidigast efter 30 s, förslaget gäller högst 30 s, aldrig under tal eller åtgärd. Server: 6 per minut och kanal, 10 s mellanrum | live-idle.mjs:237-258; idle-advice.mjs:4,157-160; idle-policy-editor.tsx:255 |
| Läge per fas | `lane.openclaw.{idle,deal,reveal,speak}` = off, rules, random, shadow, active, sparat i sammansättningen. Publicerat rum läser det server-side, klientens begäran ignoreras, saknat läge = off | Fasen `probe` är giltig i schemat men jag hittade ingen läsare | shared-room-presentation-selection.mjs:16-19,70; studio-model.mjs:39,215-217 |
| Chattsvar | Ingen klippmängd; tal genereras | speech-pose-gate: svaret hålls tills dealern visar standard-idle med giltigt bevis, synlig flik, ljud på, samma sessions- och rundrevision. `silence` spelar inget | speech-pose-gate.mjs:110-117,171-189; chat-decision-player.mjs:5-8 |

Viktiga begränsningar jag fann:
- Treskiktsrenderaren (`layered`, standard för sammansättning) har `observeChat() {}`; klippråd efter chatt körs bara i den äldre `local-presentation` (layered-presentation.mjs:130; app.mjs:88,197-215). K04:s idlekedja saknar OpenClaw-val (JOHN-HANDOFF:480-482).
- Produktionen skickar ingen `context` till klippvalet (presentation-api.mjs:236; shared-room-presentation-selection.mjs:82). Direktorn ser bara händelse, kandidater och, vid idle, en spelarrad. Persona och temperament når den inte.
- Redigeraren lovar "chatt och persona" (studio-policy-panel.tsx:20,133) men ingen persona skickas. Fältet `context.temperament.mood` finns (engine.mjs:94-98) men har ingen produktionskälla (observation-context.mjs:31; test idle-advice-server.test.mjs:227-239).

## 2. Inställningar

"Utan deploy" = ändras av Admin utan ny kod eller env. Allt "Nej" kräver Git och manuell Render-deploy (`autoDeployTrigger: "off"`, render.yaml:12,69).

| Inställning | Var den ligger | Omfång | Utan deploy? |
| --- | --- | --- | --- |
| Systemprompt chatt (persona, ton "briefly and warmly") | `PRODUCT_SPEECH_SYSTEM`, product-speech.mjs:186-193; Astrid-tillägg :223 | Global; språk- och minnesdelen bara Astrid | Nej: Director-deploy |
| Rollens AGENTS.md | `deploy/runtime-bundle/roles/croupier-speech.md`, `manifest.json` (2026-09-26.1), synkas vid Gateway-start | Per roll (5 st) | Nej. Egna rader utanför blocket samt SOUL.md/IDENTITY.md rörs aldrig (runtime-bundle/README.md); redigering via OpenClaw-dashboarden ej verifierad |
| Prompt klippråd (Director) | openclaw.mjs:72; roles/croupier-director.md. Insultklausul bara för `renderer-idle.astrid` | Global, Astrid-klausul | Nej |
| Prompt probe, operatörschatt, social | product-probe.mjs:94-103; openclaw.mjs:96; social.mjs:72-82 | Global (probe och social Astrid) | Nej |
| Social policy (Ledsen: direktiv, tröskel 0,75, cooldown 10 s, fri eller fast replik) | Neon `doc:social`, seed apps/studio/policies/social.seed.json; Admin Spelhändelser och regler > SocialChatPanel | Ett dokument, låst till astrid/idle.ready (social.mjs:5,43) | Ja, men ytan är lab och kandidat att radera (ADMIN-KARTA 4c); produkten läser den inte |
| Persona per dealer | Finns inte. Dealer = `{id, label, speechProfile?, rouletteIdle?, rouletteStart?}` (studio-model.mjs:416) | – | – |
| Tillåtna verktyg | Alla roller `tools.deny ['*']`, inga skills, minnessök av, heartbeat 0 (gateway-config.mjs:65-74,102-104); varje anrop `tool_choice: 'none'` | Per roll, alla nekade | Nej. Admin kan bara ändra modell (studio-admin.mjs:55-84). Speech- och socialrollens verktyg låses av startkontroll (gateway-config.mjs:202-205,243-248) |
| Rättigheter: vad agenten läser | Ny projektion, aldrig spridning: dealerId, revisioner, spelarnamn, publika kort (dolt kort bort), publicerade händelser, `allowedSpeech`, historik (30 rader). Astrid: minnesfakta, kamerabilder. Bara i `lissabon-stream-lane`: demoresultat `playResults`. Aldrig skon, plånbokssaldo, cookie, spelar-ID | Global, per anrop | Nej (openclaw-chat.mjs:122-170; server.mjs:590-591) |
| Rättigheter: vad agenten får göra | Bara JSON-val enligt kontrakt; kort, RNG, insats, saldo och timing ligger hos motorn | Global | Nej |
| Roll-modell (5 roller) | Gatewayns `openclaw.json` på Render-disk; seed `gpt-5.6-terra` via OpenAI Responses (render.yaml:81-85) | Per roll | Ja: Admin > OpenClaw > Agentmodeller (openclaw-workspace.tsx:240-262; Gateway `config.patch`, kan ge omstart). Risk: speech-rollens primär måste vara lika med chat-rollens, annars stoppar nästa Gateway-start (gateway-config.mjs:243-248, test :245-254) |
| Chattmodell Astrid | `project.probePolicy.model` (Neon): gateway-default, gpt-5.4-mini, gpt-6-luna, gpt-5.6-terra | Ett värde, bara Astrid | Ja: Admin > OpenClaw > Tal vid inaktivitet (probe-editor.tsx:41) |
| Chattmodell övriga dealers | Rollens primärmodell (`gateway-default`, server.mjs:1193) | Per roll | Ja, via raden ovan |
| Djupare modell (eskalering) | Director-env `OPENCLAW_SPEECH_ROUTING` (live adaptive; blueprint säger fixed, render.yaml:49), `OPENCLAW_SPEECH_DEEP_MODEL` gpt-6-sol (:51) | Global; verkar bara för `astrid` (speech-routing.mjs:11) | Nej: Render-env |
| Tidsgränser | `OPENCLAW_TIMEOUT_MS` (kod 2500, blueprint 8000, 50-30000), `OPENCLAW_SPEECH_TIMEOUT_MS` (1000-30000, 20000 vid adaptive, ett gemensamt tak för båda passen). Hårt: social 30 s, operatörschatt 30 s, tokens 512/2048 (klipp 256) | Global; chatttaket sätts på både spelmotorn (croupier-v3, då croupier-v2) och Director | Nej (configuration.mjs:20,30,36; speech-routing.mjs:8-19,36-53) |
| Språk | Astrid engelska som regel, byte bara om aktuell rad ber om det (product-speech.mjs:223; croupier-speech.md:7-15). Övriga dealers: ingen språkregel. Probe: en/sv/de/fr/es. Social och operatör: svenska | Astrid-specifikt | Nej |
| Probe-policy (läge, väntetid, paus, sannolikhet, max/timme, minne) | `project.probePolicy` (Neon) | Ett dokument, bara Astrid (control-probe-page.tsx:34) | Ja |
| Läge per fas | `lane.openclaw` i sammansättningen, Admin > Scen och lager > Automatik/OpenClaw (studio-composition-panel.tsx:104) | Per sammansättning, alltså alla dealers i den lanen | Ja, men publicerat rum är fruset (frozen-dealer-presentation.mjs:121): kräver ny publicering |
| Vilka klipp OpenClaw får välja | `idlePolicy.variants[].use` plus `description`; `variants[].selection.model`, `priority` | Per dealer | Ja: Klippkartan (studio-policy-panel.tsx) |
| Dealerns röst och leverans | `dealer.speechProfile.voice` (leverantör, röst-ID, ElevenLabs stability/style/similarity) och referensvideo | Per dealer | Ja, om `CROUPIER_DEALER_SPEECH_PROFILES=1` |
| Adminroboten | `ASSISTANT_MODELS`, assistant-model.mjs:4-8 (eget OpenAI-anrop, inte Gateway) | Global | Nej |

## 3. Per dealer idag

| Nivå | Vad | Konsekvens |
| --- | --- | --- |
| Per dealer, Admin utan deploy | Röst och läppsynksreferens, beteendeklipp (intervall, spelhändelse, OpenClaw, beskrivning), variantval per plats, inspelade repliker och språk | Dealers skiljer sig i röst, bild och vilka klipp som får väljas. Inte i vad de säger |
| Per sammansättning (lane) | Läge per fas; en lane kan rymma flera dealers och delar då läget | Går inte att ge dealer A "aktiv" och dealer B "av" i samma lane |
| Ett dokument för hela projektet | Probe-policy och chattmodell (Astrid), social policy (Astrid, lab), trigger-bibliotek | Andra dealers har varken initiativ, minne, egen modell eller eskalering |
| Global i kod/env | Chattprompt, klippprompt, verktyg, tidsgränser, routing, språkregler, `allowedSpeech` | En lugn och en lättirriterad dealer får idag samma instruktion. Prompten säger "briefly and warmly" åt alla |

Fakta som påverkar temperament:
- "Dealerns agent" i Admin är den äldre operatörschatten (`/api/chat`, `croupier-chat`); dealer-ID:t används bara som katalogdata (gateway-panel.tsx:56-60; openclaw.mjs:86-103; studio-server.mjs:48-55). Fliken sätter ingen persona.
- Det enda befintliga temperamentet är hårdkodat: Astrids insultregel i klippprompten, nycklad på `renderer-idle.astrid` (openclaw.mjs:72). Andra dealers saknar klausulen och alla OpenClaw-klipp har prioritet 10 mot baseline 0 (idle-advice.mjs:90-95), så prompten lutar mot att välja ett klipp (slutsats från texten, ej körprov).
- Rollen kan inte bytas per dealer: `requireSpeechRole` kräver exakt `openclaw/croupier-speech` (product-speech.mjs:195-197) och Admin känner fem fasta roller (studio-admin-contract.mjs:4).
- Studions eget idle-prov är begränsat till Astrid (idle-reaction-input.mjs:4); produktens `observeChat` är det inte (local-presentation.mjs:99).

## 4. Gap: två dealers med olika temperament, inställt från Admin

| # | Vad saknas | Fält / kod som behövs | Admin-yta som bör äga det | Deploy-styrt idag |
| --- | --- | --- | --- | --- |
| G1 | Ingen persona- eller temperamentpost per dealer | Nytt fält på dealern, t.ex. `agentProfile`: förval (lugn, varm, lekfull, återhållsam, lättirriterad), tålamod/tolerans 0-1, kort persona-text (max ~300 tecken), svarsspråk, svarslängd. Validering i studio-model.mjs:416 och studio.schema.json; Neon `doc:project` | Dealerregister `/admin/dealers` eller Klippkartans dealerkontext (Jakobs val, fråga 3) | Allt; fältet finns inte |
| G2 | Chattprompten är en och generisk | Bär profilen genom kedjan: hämta ur fruset paket i `authoritativeChatStatus` (server.mjs:573), projicera i openclaw-chat.mjs:146-169, tillåt i exakta nyckellistan product-speech.mjs:98, lägg persona-block i prompten :220-224 och låt det kunna överstyra "briefly and warmly" (:187). Profilrevision i `readStatus` (stale som `stale_chat_memory`) | Samma post som G1, plus provchatt per dealer | Director-kod och spelserver; ordning: tolerant Director först, sedan spelservern |
| G3 | Temperament når inte klippvalet | Skicka `context.temperament.mood` till `select` och idle-råd (presentation-api.mjs:236; shared-room-presentation-selection.mjs:82; idle-advice.mjs:50). Lägg `irritable` i enumen (engine.mjs:96, studio-model.mjs:74, studio.schema.json:2897, catalog.schema.json:249, studio-types.ts:23, test-context.tsx:5). Byt testlåsen idle-advice-server.test.mjs:227-239 och game-stream-lifecycle.test.mjs:403 | Villkorsbyggaren finns (trigger-editor.tsx, kategori Temperament); källan ska komma från dealern, inte testkontext | Kod i Director-schema, spelserver och Studio |
| G4 | Astrid-hårdkodningar | Gör datadrivna per dealer: insultregeln (openclaw.mjs:72), engelska som standard (product-speech.mjs:223), adaptiv eskalering (speech-routing.mjs:11), minne/kamera/probe (control-probe-page.tsx:34) | Dealerposten (språk, djupt läge av/på); probe-policy per dealer | Kod och Render-env |
| G5 | Modell per dealer | `agentProfile.model` ur `PRODUCT_SPEECH_MODELS` (product-speech.mjs:11) i stället för globala `probePolicy.model`; djupt läge per dealer. Hantera att speech-rollens primär måste vara lika med chat-rollen (gateway-config.mjs:243-248) | Dealerposten; Agentmodeller visar rollens standard | Astrids modell är Admin-styrd; övriga och eskalering är roll/env |
| G6 | Temperament i bild (klipp) saknar väg i treskiktsruntimen | `observeChat` är tom i layered (layered-presentation.mjs:130); K04 `room-idle.mjs` saknar OpenClaw-val (JOHN-HANDOFF:480-482). Utan detta slår temperamentet bara igenom i ord och röst | Läget per fas i Scen och lager finns men måste få effekt i layered | Kod |
| G7 | Fliken "Dealerns agent" är fel yta | Byt ut eller bygg om: dealerväljare, profilformulär, provchatt som visar vilken profilrevision som svarade. Ta bort missvisande text "chatt och persona" tills det är sant (studio-policy-panel.tsx:20,133) | OpenClaw > Dealerns agent, eller dealerposten | Klientkod |
| G8 | Pratsamhet (initiativ) är global och Astrid-låst | `probePolicy` per dealer (sannolikhet, paus, max/timme); generalisera probe-runtime och ProbeEditor | OpenClaw > Tal vid inaktivitet, per dealer | Kod |
| G9 | Social policy är ett dokument och används inte av produkten | Avveckla (ADMIN-KARTA fråga 7) eller bygg om som mall för G1; räknas inte som lösning idag | Spelhändelser och regler (lab) | Kod |
| G10 | Säkerhet och bevis | Persona-text är operatörstext men valideras (längd, kontrolltecken); regler om spel, pengar och dolda kort ligger kvar ovanför. Negativa prov, logg av profilrevision, minst ett verkligt modellprov per temperament (mockar bevisar inte ton) | Provspelning/provchatt | Test och drift |

Fem viktigaste: G1 (fältet finns inte), G2 (profilen når inte chattprompten), G3 (temperament når inte klippvalet), G6 (layered runtime ignorerar chatt-klippråd), G4/G5 (Astrid-hårdkodning och modell per dealer).

## 5. Frågor till Jakob

1. Vad menar du med temperament först: ton i orden, hur lätt dealern blir förolämpad (klippreaktion), pratsamhet, eller alla tre?
2. Fritext-persona eller bara förval? Vem får skriva texten: bara Admin (nivå 1)?
3. Vilken yta ska äga dealerprofilen: Dealerregister eller Klippkartans dealerkontext? `dealer-studio` är föreslagen att raderas (ADMIN-KARTA D2). Ska fliken "Dealerns agent" döpas om eller ersättas?
4. Ska temperamentet styra klipp (blick, "förolämpad")? Då måste treskiktsruntimens idle få OpenClaw-val (K04) innan G3 ger effekt i bild.
5. Gäller Astrids engelska standardspråk även andra dealers, eller ska språk bli ett fält per dealer?
6. Ska den sociala labbchatten bort (fråga 7 i ADMIN-KARTA) eller användas som förlaga?
7. Bekräfta live-värdet `OPENCLAW_SPEECH_ROUTING=adaptive` på Render. Blueprinten säger `fixed`; vem uppdaterar den?
8. Får speech-rollens modell skilja sig från chat-rollens? Det kräver ändrad startkontroll i gateway-config.mjs.
9. Djupare modell (`gpt-6-sol`) per dealer kostar mer. Vem godkänner betald drift?
