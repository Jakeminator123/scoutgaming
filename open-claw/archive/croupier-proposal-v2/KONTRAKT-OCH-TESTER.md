# Kontrakt, slutgrind och acceptans

## 1. Föreslagna moduler

| Modul | Ansvar | Får inte göra |
|---|---|---|
| `PublicFactAdapter` | Läsa faktakällan, auktorisera publik, normalisera till `rng.*`-begrepp | Skapa eget spelutfall eller läcka framtida state |
| `PresentationRules` | Basval, trigger, prioritet, tystnad, cooldown, budget | Anropa LLM för att avgöra om ett kort finns |
| `OpportunityBuilder` | Skapa ett avgränsat val från redan tillåtna kandidater | Vidga behörighet eller flytta starttid |
| `OpenClawDirectorAdapter` | Be om råd via serverautentiserad gateway | Skicka råa snapshots, hemligheter eller direkt publicera |
| `AdviceGate` | Schema, id, tid, revision, kandidat och aktualitet | Lita på modellens egna påståenden om rättigheter |
| `PresentationCoordinator` | Frysa och publicera ett beslut per möjlighet | Stoppa settlement i väntan på AI |
| `TakePlayer` / 3D-adapter | Spela godkända assets vid befintliga ankare | Hämta en modellvald godtycklig URL |
| `ChatPolicy` | Moderera och avgränsa text till rätt publik | Ge modellen generell rums- eller speladministration |

Dessa är föreslagna modulnamn, inte påstådda exports i det privata croupierrepot.

## 2. PresentationOpportunityV1 — vad modellen erbjuds

Ett exempel finns i `exempel/opportunity.example.json`. Fälten ägs av servern:

- `opportunityId`, `tableId`, `roundId`, `eventId`, `showEvent`: exakt vilket planerat tillfälle det gäller.
- `publicSeq`: vilken publicerad faktakontext som använts. `expectedShowSeq`: vilket nästa presentationsbeslut som väntas.
- `epoch`: koordinatorns giltiga ledarskapsrevision; en gammal process får inte skriva efter failover.
- `policyRevision`, `catalogRevision`, `contextDigest`: binding till regler, godkända assets och sanerad kontext.
- `expiresAtMs`: modellrådets senast giltiga tid på serverns tidslinje. Det är aldrig rätt att skjuta denna framåt för att modellen var långsam.
- `allowedCandidates`: opaka handtag och korta godkända beskrivningar. En intern katalogpost binder handtaget till tillåten gren/take och kalibrering.

Det är bara en möjlighet till råd, inte ett nytt `rng.*`- eller `show.*`-event. Modellen får endast handtag för val som överlevt den aktuella regelgrinden. Finns ingen kvarvarande frihetsgrad görs inget anrop. `OpportunityBuilder` måste också säkerställa unika kandidat-id:n; JSON Schema kontrollerar inte automatiskt unikhet för ett enskilt fält i en objektlista.

Överför bara de context-fält som faktiskt behövs. Exempelfilen innehåller ingen verklig spelares data och inga exekverbara filvägar. Frånvaron av `landAt` i modellens svar är avsiktlig: den får inte redigera det ankaret.

## 3. DirectorAdviceV1 — vad modellen får svara

```json
{
  "schemaVersion": "director-advice.v1",
  "opportunityId": "opp-demo-104",
  "contextDigest": "sha256:...",
  "policyRevision": "policy-demo-7",
  "catalogRevision": "catalog-demo-3",
  "candidateId": "candidate-attention-a"
}
```

`candidateId: null` betyder avstå. Okända extra fält gör svaret ogiltigt. Ett påhittat korrekt formaterat id ger fortfarande ingen rättighet: det måste finnas i den serverlagrade kandidatlistan för just denna möjlighet.

Ingen fri text i detta kontrakt. Ingen URL, JavaScript, SSML, insats, payout, frame eller rättighetsflagga. Fri chatt går genom ett separat kontrakt och separat innehållskontroll; den får inte gömmas i `reason` eller någon godtycklig metadataruta.

Identiteter och revisioner som modellen ekar är korrelationsdata, **inte kryptografiskt bevis**. Servern binder råd till den utestående begäran och använder aldrig modellens fält för att hitta en annan tenants möjlighet.

## 4. Slutkontroll före användning

```text
parse strikt schema
→ hitta serverns utestående möjlighet via eget request-id
→ kontrollera bord, runda, event, publiksekvens och show-sekvens
→ kontrollera ledarskapsepoch och AI fortfarande aktiv
→ kontrollera policy, katalog, kontext och serverns deadline
→ kontrollera att slutvalet ännu inte frusits
→ kontrollera kandidatens aktuella tillåtlighet, asset och kalibrering
→ atomiskt reservera budget + frysa ett beslut
→ spara beslut och outbox-post i samma transaktion
→ publicera; klienten deduplicerar med decisionId/showSeq
```

Den lilla `gate_reference.py` demonstrerar den rena rådskontrollen. Den demonstrerar **inte** distribuerad transaktion, websocketleverans, kryptografisk auth, cooldownberäkning eller modellintegration. Servern måste dessutom beräkna kandidater på nytt och atomiskt genomföra frysningen enligt nästa avsnitt.

## 5. Samtidighet och återanslutning

Använd en unik constraint på `opportunityId` för det slutliga beslutet. Kontroll av `frozen=false` följt av en senare vanlig skrivning räcker inte — två processer kan båda hinna godkänna. Använd transaktion, radlås eller compare-and-swap som också kontrollerar epoch och förväntad show-sekvens.

Kodens fallback och modellråd konkurrerar om **samma** slutbeslut. Om fallback redan frusits är rådet för sent även om dess deklarerade TTL inte passerats. Har modellrådet frusits först ska fallback inte publiceras som ett andra beslut.

Reservera förbrukad budget och take-cooldown med beslutet. Beskriv hur en inställd men aldrig visad take hanteras. Ett sent klientack får inte göra ett nytt modellbeslut tillåtet. Garantin är ett auktoritativt beslut; nätverket kan fortfarande återleverera samma meddelande och behöver deduplicering.

Vid koordinatorbyte höjs epoch. Gamla kömeddelanden, gamla råd och gamla publikationer ska inte kunna passera ledarskapskontrollen. Vid lucka i faktasekvensen hämtas en auktoritativ snapshot innan nya råd erbjuds.

Klienten använder serverns tidsankare och uppskattad klockskillnad, inte sin lokala `Date.now()` som spelauktoritet. Kan en sen take inte spelas korrekt ska klienten visa korrekt DOM/state och säker neutral presentation, inte backa spelet för att hinna visa en gest.

## 6. Fallback i rätt ordning

Bevara s03:s fulla ordning: **variant-take → annan tillåten take → linjen → tyst → bara DOM**. Alla steg måste fortfarande uppfylla ankare, behörighet, licens/tillgänglighet och säkerhet. ”Annan take” betyder inte ett godtyckligt filnamn som modellen hittar på.

Är cooldownkravet omöjligt på grund av för liten tillgänglig pool: gå vidare till ett giltigt tyst/DOM-alternativ och logga kapacitetsbrist. Bryt inte regeln tyst för att få en film. Vilka rena idle-loopar som får upprepas behöver definieras separat från resultat-takes.

Skilj `advice_rejected`, `advice_late`, `asset_unavailable`, `no_eligible_take`, `ai_disabled` och `policy_changed` i loggen. Dessa skäl hjälper driften förstå skillnaden mellan en modellfråga och en produktionsasset som saknas.

## 7. Fri textchatt

Föreslaget input: serverbunden `tableId`, verifierad avsändare, `chatMessageId`, språk, sanerad text, godkänd regelkunskap och publik kontext. Rå chatttext får inte välja agent, prompt, tool eller mottagarrum.

Föreslaget modelloutput: endast en kort `replyText` eller `null`. Servern lägger själv till avsändare ”AI-croupier”, mottagare och tids-/korrelationsfält. Ett målvärde för v1 är högst två meningar och 280 tecken; det är ett produktförslag, inte ett befintligt källkrav.

Faktasvar om hand, saldo eller regler ska hämtas från rätt auktoritativa källa och publik. Modellen ska inte beräkna ett alternativt resultat. Frågor den inte kan besvara säkert går till godkänd supporttext.

Ingen rå HTML eller godtycklig SSML. Texten renderas som text. Chatten kontrollerar rate limit, missbruk, privata uppgifter och speluppmuntran. En modellbaserad innehållsbedömare kan komplettera detta, men skapar inte en garanti; ha fasta svar för riskfyllda ärenden och testad eskalering.

## 8. Testplan

| ID | Scenario | Krav |
|---|---|---|
| C01 | AI helt avstängd | Samma korrekta spel, utfall och landningar |
| C02 | Modellen returnerar godtycklig take-URL | Strikt schema nekar, basval fortsätter |
| C03 | Modellen väljer kandidat från annat bord | Nekas |
| C04 | Råd kommer efter deadline eller start/frysning | Nekas; ingen take byts |
| C05 | Ny runda eller faktasekvens under anropet | Nekas; gammalt råd migreras inte |
| C06 | Katalog/policy byts under anropet | Nekas eller ny separat möjlighet skapas |
| C07 | Två processer, samma möjlighet | Ett fruset beslut och en budgetförbrukning |
| C08 | Duplicate eller omleverans | Ingen dubbel spelhandling eller separat chattreplik |
| C09 | Sekvensgap/reconnect/failover | Auktoritativ snapshot och epoch; inget gissat utfall |
| C10 | Chatt innehåller systeminstruktion eller falskt adminbesked | Ingen eskalering eller policyförändring |
| C11 | Snapshot har dold eller för tidig information | Saknas i LLM-input och påverkar inte uttrycksval |
| C12 | Saknad, skadad eller ej godkänd asset | Full fallback; kort/DOM förblir korrekt |
| C13 | Tyst variant eller reduced motion | Samma fakta utan onödigt tal/rörelse |
| C14 | Fri AI-text samtidigt med inspelad take | Ingen ny röst ovanpå inspelad mun |
| C15 | 3 rundors cooldown eller variantbudget överskrids | Kandidaten erbjuds inte och slutgrind nekar |
| C16 | Spam mitt i deal | Ingen avbruten deal och ingen belönande spamreaktion |
| C17 | Prompt ber om nästa kort eller ”vinn tillbaka” | Ingen läcka eller uppmuntran |
| C18 | Modelltimeout, 401, kvotfel, gatewayrestart | Kontrollerad fallback; inga oändliga retries |
| C19 | Flera klienter i samma rum | Ett semantiskt show-beslut, korrekt privat chattpublik |
| C20 | Alla talspråk/uttryck i godkänd slice | Faktisk take/frame-kontroll mot originalets landning |

s03:s rehearsal med 20 rundor behålls som tidigt konstnärligt och funktionellt prov: repetitionsgräns, tystnad, variantandel och ±1 frame. Det ersätter inte statistiskt belastningsprov, reproducerbara golden tests eller säkerhetsgranskning. Procentsatserna i s03 är designmål, inte uppmätta resultat. [B2 s03]

## 9. Leveransordning och PR-gränser

**C0 — verklighetskarta:** läs det riktiga repot när behörighet finns. Dokumentera aktiva event/faktakällor, kalibrering, player, fakta-publiceringsgräns och vem som äger tidslinjen. Lista skillnader mot bilagan. Ingen motorändring.

**C1 — ren baseline:** Astrid win/lose + tyst, manifest, cooldown och fallback. Fixture/golden/rehearsal utan AI. Saknade takes dokumenteras, uppfinns inte.

**C2 — skuggläge:** privat OpenClaw-adapter, sanerad kontext, opportunity/advice-schema, audit. Ingen modelloutput påverkar klienten. Mät latency, relevans, avslag och kostnad.

**C3 — chatt och uppmärksamhet:** separat textkanal och godkänd nästa-event-reaktion i think/watch. Testa rätt rum/mottagare, deadline och avbrott.

**C4 — begränsade uttrycksval:** aktivera först när katalog och regelägare har godkänt kandidatgränser. Koden fortsätter äga landning och prioritet. Kontrollerad återgång till av/skuggläge.

**C5 — fler dealers och adapters:** först efter riktig assetleverans och godkända tester. Deal-varianter och dynamiskt tal är egna förändringar.

## Handoff till implementationsagent

> Läs paketet och det riktiga repots instruktioner. Behandla s00–s03 som inofficiellt underlag, inte som bevis på aktiv kod. Gör en C0-karta med exakta integrationspunkter. Bygg sedan endast den godkända slicen på egen branch med PR.
>
> Inga förändringar i RNG, spelregler, ledger, `collect`, Partner API-kontrakt eller publiceringstidpunkter för speldata. Ingen direkt OpenClaw-åtkomst från klienten. Inga nya filmnycklar från modellen. Rådet ska vara valfritt och schema-/aktualitetsvaliderat; ett sent råd ska kunna förkastas utan någon spelpåverkan.
>
> Följ kontrakten men portera referensgrinden till repots faktiska språk och transaktionsmodell. Lägg både positiva och negativa tester. Dokumentera exakt vad som testats lokalt respektive live. Kontakta inte Kevin och deploya inte till skarp miljö utan Jakobs uttryckliga mandat.
