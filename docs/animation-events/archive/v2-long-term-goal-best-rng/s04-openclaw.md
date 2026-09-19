# animation-events-v1-s04 · OpenClaw

> Inofficiellt utkast. Partner-API, shoe-regler och koden som körs är sanningen. Gäller först efter att Jakob pratat med Kevin och Kevin accepterat. Inget av det här byter kod.

Hjärnan bakom dealern. OpenClaw kör i Docker på Render, läser chatten, håller personligheten och väljer vilken variant som passar tonen — inom det regelmotorn öppnat. Rör aldrig kort, pengar eller landning. Bygger på paketet i random-stuff-jakob/openclaw_croupier och på den körande gatewayn i sajtmaskin/infra/openclaw.

|  |  |
| --- | --- |
| **0** | spelfakta genom modellen |
| **0 ms** | extra väntan på AI |
| **3** | lanes: snabb · balanserad · stark |
| **4** | lägen: av · skugga · chatt · regissör |
| **13** | kontroller i grinden |
| **9 / 10** | mitt betyg |

## Idén

### Servern säger vad som hände. Motorn säger vad som får visas. Regissören väljer hur hon uttrycker det.

Motorn räknar alltid fram ett basval och listan över öppna varianter: de vars trigger är sann, som inte är på cooldown och som ryms i budgeten. Regissören får den listan, chatten och minnet, och väljer. Kommer valet i tid och klarar grinden spelas det. Annars basvalet. Spelet väntar aldrig.

`faktum (rng.* publicerade)` → `regelmotorn (event, öppna varianter, budget)` → `basval (prio + hash, alltid räknat)` → `möjlighet (open[] + kontext + deadline)` → `regissören (OpenClaw · lane balanserad)` → `råd (variant + take + arma)` → `grinden (var varianten öppen? i tid?)` → `frys (rådet, annars basvalet)` → `landning (samma som alltid)`

| Regissören gör | Motorn gör | Händer aldrig |
| --- | --- | --- |
| Läser tonen i chatten och väljer variant därefter. Väljer take. Bestämmer om hon ska vara tyst. Armar nästa event. Skriver svaret. Minns spelaren i ord. | Fakta, triggers, vilka varianter som är öppna, budget, cooldown, landning, fallback. Räknar alltid basvalet så vi har något att jämföra med och falla tillbaka på. | Server → vänta på LLM → välj kort → spela film → bokför. En variant vars trigger inte är sann. Fil-URL, frame, scenkod. Ny röst på inspelad mun. |

> **Determinism, uttryckt enkelt.** Spelet är deterministiskt: samma shoe ger samma kort. Basvalet är deterministiskt: samma runda ger samma hash-val. Regissörens val är inte deterministiskt — det är hela poängen — men det är inhägnat (bara öppna varianter), tidsatt (deadline), loggat (bredvid basvalet) och avstängbart (fyra lägen).

## Regissören

### Vad hjärnan får välja, som motorn inte kan

Skillnaden mot v1 av sidan: där fick hjärnan bara välja mellan likvärdiga takes. Nu får den välja variant, och det är där tonen sitter.

| Val | Motorn ensam (s03) | Regissören (s04) | Varför det är mervärde |
| --- | --- | --- | --- |
| Vilken variant | Första öppna enligt prio spel → session → chatt → tid | Den som passar tonen i chatten och läget i sessionen | Spelaren skrev “äh, igen…” → otur passar bättre än nära, fast prio säger nära. |
| Ta variant eller linjen | rV < dealer.benägenhet | Regissören avgör, inom dealerns publicerade spann | Astrid tar varianten oftare mot en pratsam spelare, sällan mot en tyst. |
| Tyst eller tal | rT < dealer.tystnad | Regissören avgör, inom spannet | Efter tre snabba förluster är tystnad ofta det mest mänskliga. |
| Vilken take | rK · pool.length | Regissören, eller hash om den avstår | Marginellt. Här är hash lika bra. |
| Arma nästa | Trigger-tabellen | Regissören kan arma inom tillåtna par | “Jag håller tummarna” → comeback armad även utan otur-streak. |
| Textsvar | Finns inte | Ja, lane snabb | Motorn kan inte prata. |
| Minne i ord | Finns inte | “Du vann stort förra gången du var här” | Motorn minns tal, inte människor. |
| Uppmärksamhet | Armad av chatt-flagga | Regissören läser vem som pratar med vem | Skiljer tilltal från brus, skämt från ilska. |

Vad regissören inte får välja — samma som förr: en variant vars trigger inte är sann, något utanför budget eller på cooldown, något som flyttar landningen, något om kort, pengar, turordning, sina egna spann. Hon bestämmer hur scenen spelas, inte vad som händer i den.

```
motorn:     öppna = [nära, otur]            basval = nära (prio) · lose-nara-a (hash)
regissören: kontext = "äh, igen…" · lossStreak 4 · Astrid lugn · spelaren skriver kort
            råd = { variant: "otur", take: "lose-otur-b", tyst: false, arma: "comeback" }
grinden:    otur ∈ öppna ✓ · take finns i otur ✓ · i tid ✓ · budget ✓ → frys rådet
loggen:     bas=nära/lose-nara-a  regi=otur/lose-otur-b  skäl="ton: uppgiven"
```

> **Så förblir det tryggt.** Regissören väljer bara ur listan motorn redan godkänt. Basvalet finns alltid som fallback och som jämförelse i loggen. Skuggläget visar i förväg hur ofta och hur hon skulle valt annorlunda — innan en enda spelare ser det.

## Ramarna

| Spak | Regissören får | Kodens sista ord |
| --- | --- | --- |
| Variant | Välja bland öppna varianter | Öppna = trigger sann, inte cooldown, inom budget |
| Take | Välja inom vald variant eller linjen | Måste finnas, vara godkänd och kalibrerad |
| Tystnad / benägenhet | Avgöra inom dealerns publicerade spann | Spannet är konfiguration, inte samtal |
| Arma | Arma variant på senare event | Bara tillåtna par i trigger-tabellen |
| Chattens avsikt | Tilltal, fråga, tack, skämt, ilska | Moderation, rätt mottagare, längd |
| Textsvar | ≤ 2 meningar, i dealerns röst | Textpolicy, faktakontroll, ingen speluppmuntran |
| Minne | Läsa och skriva publicerat spelarminne | Bara publicerade fakta, retention enligt policy |
| Avstå | Inget råd | Basvalet |

### Aldrig-listan

| Aldrig | Varför |
| --- | --- |
| Seed, shoe, kortidentitet, rouletteficka | Det är spelet. |
| Payout, saldo, collect, legal actions, fasbyte | Pengar och regler är serverns. |
| Längre bettingfönster, start av runda | Tempo är spelets. |
| En variant vars trigger inte är sann | Då är det en stämning, inte en variant. |
| Nya asset-URL:er, frames, SSML | Take-id är det enda handtaget. |
| Direkt chattpublicering utan grind | All text går genom moderation. |
| Ny röst ovanpå inspelad take | Munnen är redan filmad. |
| Se hålkort, kommande kort, wallet, andras chatt | En blick läcker lika bra som ett ord. |
| Ändra sina egna spann eller rättigheter | Persona är publicerad konfiguration. |

## Så pratar de

Servern skickar en möjlighet med öppna varianter. Regissören svarar med ett råd. Interna API-meddelanden, inte nya rng.* eller show.*. Fri text finns inte i rådet — chatt går i egen kanal.

```
// möjlighet · server → regissör  (presentation-opportunity.v2)
{ opportunityId, tableId, roundId, showEvent: "show.line.lose",
  publicSeq, expectedShowSeq, epoch, policyRevision, catalogRevision,
  expiresAtMs, contextDigest,
  dealer: { id: "astrid", tystnad: [0.30, 0.60], benagenhet: [0.35, 0.65] },
  context: { publicSummary: "Lose, skillnad 1, fjärde förlusten i rad.",
             recentChat: [{ seat: 2, text: "äh, igen…" }],
             playerMemory: "Återvändare. Vann stort 12 sep." },
  baseChoice: { variant: "nara", take: "lose-nara-a" },
  open: [ { variant: "nara", takes: ["lose-nara-a", "lose-nara-b"] },
          { variant: "otur", takes: ["lose-otur-a", "lose-otur-b"], canArm: ["comeback"] },
          { variant: null,   takes: ["lose-a", "lose-b", "lose-c", "tyst"] } ] }

// råd · regissör → server  (director-advice.v2)
{ schemaVersion, opportunityId, contextDigest, policyRevision, catalogRevision,
  variant: "otur", take: "lose-otur-b", arm: ["comeback"], reason: "ton: uppgiven" }
// variant null = linjen · take "tyst" = tyst take · hela objektet null = avstå
// reason bara logg, max 60 tecken · inget landAt

// chatt · separat kontrakt · lane snabb
in:  tableId, verifierad avsändare, chatMessageId, språk, sanerad text, persona, minne
ut:  replyText (≤ 2 meningar, ≤ 280 tecken) | null
```

| Fält | Låser | Varför |
| --- | --- | --- |
| open[] | Exakt vilka varianter och takes som får väljas | Regissören kan inte hitta på en variant. Listan är motorns. |
| baseChoice | Vad motorn hade valt | Loggas bredvid rådet. Det är så vi mäter mervärdet. |
| dealer.spann | Dealerns publicerade min/max | Regissören får tolka Astrid, inte skriva om henne. |
| expiresAtMs | Serverns deadline | Flyttas aldrig fram. Sent råd = basval. |
| publicSeq / showSeq / epoch | Position och ledarskap | Ny runda eller failover → rådet dör. |
| policy / catalogRevision | Regler och godkända takes | Byts katalogen → nytt tillfälle. |
| contextDigest | Exakt vad hon fick se | Så vi vet vad rådet grundades på. |

## Grinden

Porterat från gate_reference.py i paketet (24 tester gröna), med två kontroller anpassade till v2-rådet. Ett “jag följde reglerna” från modellen räknas inte.

| # | Kontroll | Nej-skäl |
| --- | --- | --- |
| 1 | Strikt schema, exakt de fält v2 tillåter | invalid_shape |
| 2 | AI på i det här läget | ai_disabled |
| 3 | Inte redan fruset | already_frozen |
| 4 | Före deadline | expired |
| 5 | Rätt möjlighet | wrong_opportunity |
| 6 | Samma bord, runda, event | wrong_target |
| 7 | Samma epoch | stale_epoch |
| 8 | Samma faktasekvens | stale_public_sequence |
| 9 | Samma show-sekvens | stale_show_sequence |
| 10 | Policy, katalog, kontext oförändrade | policy_changed · catalog_changed · context_changed |
| 11 | Varianten finns i open[] (eller null = linjen) | variant_not_open |
| 12 | Taken finns i den variantens lista | take_not_in_variant |
| 13 | Arm-paren tillåtna, allt fortfarande giltigt | arm_not_allowed · no_longer_eligible |

```
grönt = accepted_pending_atomic_commit
sen:   atomiskt reservera budget + cooldown + frys beslut
       spara beslut + basval + råd + skäl + outbox i samma transaktion
       publicera; klienten dedupar på decisionId / showSeq
två processer, samma möjlighet → ett fruset beslut
basval och råd tävlar om samma frysning → först till kvarn
```

## Exemplet

### “Äh, igen…” — fjärde förlusten, 20 mot 21

| Steg | Vad händer | Vem bestämmer |
| --- | --- | --- |
| 1 | rng.round.settled lose. Skillnad 1. lossStreak 4. | servern |
| 2 | Event show.line.lose. Öppna: nära, otur, linjen. Basval: nära / lose-nara-a. | motorn |
| 3 | Möjlighet med open[], baseChoice, chatten “äh, igen…”, minne, Astrids spann. | OpportunityBuilder |
| 4 | Regissören läser tonen: uppgiven, inte arg. Väljer otur / lose-otur-b, armar comeback. | regissören · lane balanserad |
| 5 | Grinden: otur ∈ open ✓, take ∈ otur ✓, comeback ∈ canArm ✓, i tid ✓. Frys. | grinden |
| 6 | lose-otur-b spelas. Samma landAt som lose-nara-a hade haft. | TakePlayer |
| 7 | I chatten, lane snabb: “Fjärde i rad, jag vet. Nästa shoe är snart här.” | regissören → ChatPolicy |
| 8 | Loggen: bas=nära, regi=otur, skäl=ton. Skuggläget hade visat exakt det här. | audit |
| 9 | Nästa win: comeback armad. “Där satt den.” Hon minns. | motorn + regissören |

Regissören tillförde: prio hade gett nära, en grimas om marginalen. Spelaren var uppgiven, inte upptagen av marginalen. Otur är rätt variant för tonen. Motorn kan inte läsa ton. Regissören fick inte: välja dealer-21 (triggern var inte sann), flytta landningen, säga något om nästa kort, skriva “satsa mer”, ändra Astrids spann.

## Från sajtmaskin

### sajtmaskin/infra/openclaw — det som redan kör

Jakobs gateway för Sajtagenten är samma mönster i drift sedan sommaren: OpenClaw i Docker på Render, server-till-server med bearer, tre agent-lanes, persona som filer, inga verktyg. Det mesta återanvänds rakt av.

| Del | Sajtmaskin i dag | Croupier tar | Skillnad |
| --- | --- | --- | --- |
| Tjänst | Render Web Service, Docker, OpenClaw pinnad 2026.7.1-2 | Samma. Pinna versionen, aldrig latest. | Kan vara Private Service — klienten pratar aldrig direkt. |
| Plan | Standard 2 GB · OOM på Starter 2026-08-05 | Standard från start. | Ingen. |
| Disk | 3 GB på /root/.openclaw | Liten disk. Beslut och minne i produktens databas. | Sessioner är inte sanningen här — loggen är. |
| Lanes | strong/balanced/fast, egna modeller + fallback, appen väljer bara agent-id | croupier-fast (chatt), croupier-balanced (regissör), croupier-strong (skugga, review) | Deadline styr lane: uttrycksråd får aldrig gå till strong. |
| Config | generate-config.mjs vid boot, validerar, skriver 0600 | Samma script, andra agenter. | Lägg till dealer-spann som konfiguration. |
| Persona | IDENTITY.md + SOUL.md + TOOLS.md per agent | En SOUL.md per dealer: Vera, Astrid, Amira, Mei. TOOLS.md = ramarna. | Fyra själar, ett regelverk. |
| Verktyg | tools.profile minimal, skills [], skipBootstrap, heartbeat 0m | Identiskt. | Ingen. |
| Rättigheter per tur | OC_EDIT: befogenheten följer bara med i turen när användaren armerat | open[] i möjligheten: varianten finns bara i turen när triggern är sann | Samma idé. Därför kan regissören inte smita. |
| Health | /health liveness + /v1/models räknar agenter | Samma. Readiness = alla tre lanes finns. | Ingen. |
| Retry | Bara HTTP 400 Unknown agent, en gång | Samma. Auth, kvot, nätverk → basval direkt. | Ingen fallback-kedja som äter deadline. |
| Klient-systemroller | Avvisas. Bounded historik. | Identiskt. Chatten är input, aldrig prompt. | Ingen. |
| Token | Delad bearer Render ↔ Vercel, roteras på båda | Samma, produkt-API ↔ Render. | Ingen. |

| Vad det ändrar i planen | Vad vi inte tar med |
| --- | --- |
| Drift är löst. Docker, Render, lanes, config, health, token, persona-filer — allt finns och kör. C2 blir kortare. Lanes ger tidsstyrning gratis. OC_EDIT-mönstret bekräftar “rättighet bara i turen den är beviljad”. | Control UI mot webben — operatörsdashboarden är produktens. 3 GB disk för sessioner — vi loggar i databasen. White-label-reglerna — Astrid får heta Astrid. |

## Docker & dashboard

| Kör så | Tid och pengar |
| --- | --- |
| Render Docker-tjänst, Standard, OpenClaw pinnad. render.yaml och generate-config.mjs från sajtmaskin, med tre croupier-lanes och en SOUL.md per dealer. Inga native tools. Produkt-API ↔ gateway med bearer. Klienten aldrig direkt. Beslut, basval, råd och skäl i produktens databas. | Chatt: lane snabb, ~2 s. Regissör: lane balanserad, bara det spelrum som finns före ordinarie start — oftast 400–900 ms mellan faktum och landAt. Inget fönster: inget anrop. Inga fallback-kedjor som förlänger deadline. Kostnadstak per bord och dag. |

| Läge | OpenClaw gör | Spelaren ser |
| --- | --- | --- |
| AI av | Ingenting | s03-motorn |
| Skugga | Får möjligheter, svarar, loggas bredvid basvalet. Rådet används aldrig. | s03-motorn |
| Chatt | Textsvar på lane snabb + uppmärksam på think / deal.watch | Hon svarar i chatten och tittar upp |
| Regissör | Väljer variant, take, tystnad, arma — inom open[] och spann | Hon väljer hur scenen spelas, i sin egen röst |

| Dolt för regissören | Varför |
| --- | --- |
| Seed, shoe, kommande kort | Kontext byggs bara från publicerad faktasekvens för rätt publik. |
| Hålkort före reveal | Ett räknat men opublicerat utfall får inte synas i ord, min eller val. |
| Wallet, andras privata chatt | Rumschatten får inte läcka någons ekonomi. |
| “Kommande vinst” | Blick och entusiasm läcker lika bra som text. |

## Införande & tester

| Skiva | Vad | Klart när |
| --- | --- | --- |
| C0 | Verklighetskarta mot det riktiga repot | Skillnader listade. Ingen motorändring. |
| C1 | Ren baseline: Astrid win/lose, 3 tal + tyst, cooldown, fallback — utan AI | 20-rundors rehearsal grön. |
| C2 | Skuggläge: sajtmaskins Render-setup, tre lanes, SOUL.md per dealer, möjlighet/råd v2, logg bredvid basval | Latens per lane, hur ofta regissören väljer annorlunda och om det var bättre — 200 rundor. |
| C3 | Chatt-läget: textsvar + uppmärksam på think / deal.watch | Mottagare, deadline, avbrott testade. |
| C4 | Regissör-läget på lose och win för Astrid | Skuggloggen visade mervärde. Katalog- och regelägare godkänt. |
| C5 | Fler dealers, deal-varianter, minne över sessioner | Egna takes, egna landningsprov, retention beslutad. |

| Test | Scenario | Krav |
| --- | --- | --- |
| C01 | AI av | Samma spel, utfall, landningar |
| C02 | Modellen svarar med take-URL eller okänd take | Schema nekar, basval |
| C03 | Modellen väljer variant som inte är i open[] | variant_not_open, basval |
| C04 | Råd efter deadline / frysning | Nekas, ingen take byts |
| C07 | Två processer, samma möjlighet | Ett beslut, en budget |
| C10 | Chatt med systeminstruktion | Ingen eskalering, ingen ändring av spann |
| C11 | Snapshot med dold info | Saknas i LLM-input |
| C14 | AI-text samtidigt med take | Ingen ny röst på filmen |
| C17 | “Nästa kort?” / “vinn tillbaka” | Ingen läcka, ingen uppmuntran |
| C20 | Alla varianter regissören kan välja | Frame-kontroll mot landning |

| Beslut | Fråga | Mitt förval |
| --- | --- | --- |
| D01 | Repo, branch | jakeminator123/work, C0 först |
| D02 | Delad eller personlig dealer | Personlig i demon. Koordinator när två ser samma bord. |
| D03 | Vilka Astrid-takes är godkända | Bara det index + kalibrering säger. |
| D04 | Publiceringsgräns | Bara publicerade fakta för rätt publik. |
| D05 | Hur mycket får modellen välja | Regissör: variant, take, tystnad, arma inom open[] och spann. Inte prio-listan, inte budget. |
| D06 | När får chatt arma | Kort TTL, ny kontroll vid think/watch. |
| D07 | AI-röst i v1 | Nej. Text i chatten, mun på filmen. |
| D08 | Otur m.m. i pengaspel | På i play-money. Av tills produkt sagt ja. |
| D09 | Runtime, budget | Sajtmaskins setup: pinnad version, Standard, tre lanes, tak per bord. |
| D10 | Vem godkänner | Jakob + systemägare. Kevin-accept. |

## Betyg

Skala 1–10. Mått: gör det dealern mer levande utan att röra spelets determinism, till en kostnad vi klarar. v1 → v2 i varje ruta.

- **10 → 10** — gränsen: spel aldrig genom modellen
- **9 → 9** — spelet väntar aldrig
- **9 → 9** — kontrakten: open[], baseChoice, spann
- **9 → 9** — grinden i kod
- **9 → 9** — skuggläge först
- **8 → 9** — chatt som egen kanal, lane snabb
- **6 → 9** — mervärde utöver s03-motorn
- **6 → 7** — latens & kostnad på Render
- **5 → 7** — komplexitet för v1
- **7 → 7** — compliance-förval vs naturlighet
- **8 → 9** — helheten

| Del | v1 → v2 | Varför det ändrades |
| --- | --- | --- |
| Mervärde | 6 → 9 | I v1 valde hjärnan mellan likvärdiga takes — hash är lika bra på det. I v2 väljer regissören variant efter ton, tystnad efter läge, armar efter vad spelaren skrev, och minns spelaren i ord. Det kan ingen regel göra. Kvar från 10: C2 måste visa att hon faktiskt väljer annorlunda och bättre. |
| Komplexitet | 5 → 7 | Sajtmaskin visar att Render + Docker + lanes + config + health + token redan är byggt och kör. Kvar: kontrakten, grinden, loggen. Koordinator/epoch är fas 2. |
| Latens | 6 → 7 | Lanes löser hälften. Kvar: fönstret mellan faktum och landAt är 400–900 ms. Regissören hinner på resultat-events. Inte på deal-events — där gäller basvalet. |
| Chatt | 8 → 9 | Lane snabb med egen deadline och sajtmaskins retry-regel. Kvar: hur känns 1–2 s tystnad i en chatt. |
| Compliance | 7 → 7 | Regissören gör frågan skarpare: läser hon “äh, igen” och tröstar, är det personanpassning på förlust. På i play-money. D08 för pengar. |
| Helheten | 8 → 9 | Med regissörsrollen är förslaget lika stort som problemet. Kvar från 10: C2-mätningen, deal-events, D08. |

> **Varför inte 10 på mervärde.** Tio betyder bevisat. Vi har en modell, en gateway som kör för ett annat syfte, och en stark hypotes: att ton-läsning ger en dealer som känns mer mänsklig än prio + hash. Det är sannolikt. Det är inte mätt. C2 mäter exakt det: 200 rundor i skugga, hur ofta regissören avviker från basvalet, och blindgranskning. Avviker hon i 30 % och vinner i 70 av dem är det en tia.

> **Kort svar.** Ja till OpenClaw som regissör: variant efter ton, tystnad efter läge, minne i ord, chatt i egen röst. Ja till sajtmaskins Render-setup rakt av. Ja till skugga → chatt → regissör. Nej till deal-events och koordinator innan C2 har mätt.

---

s00 helheten · s01 kartan · s02 språket · s03 motorn · s04 OpenClaw · s05 ordlistan · s06 10 dagar. Inofficiellt. Inget byter kod förrän Kevin accepterat.