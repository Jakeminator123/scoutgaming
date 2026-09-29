# Uppdrag: Astrid Probe, spelarminne och modelljämförelse

Datum: 2026-09-28. Bas för denna beskrivning: `57a3f00` på
`jakeminator123/work`. Detta är ett implementationsuppdrag; Probe finns ännu
inte som funktion. Kontrollera aktuell kod och drift innan du ändrar något.

## Mål och avgränsning

Implementera **Probe** som en valbar kategori för Astrids egna korta,
personliga talinitiativ vid inaktivitet. Exempel på avsikt, inte fasta repliker:

- "Are you still there, Anna?"
- "I remember those two wins with ace-ten."
- En naturlig fråga om en bröllopsresa som spelaren själv har berättat om.

Repliken ska bygga på den aktuella spelarens verkliga kontext. Astrid får
välja att vara tyst. Hon får inte hitta på spelresultat eller personliga
minnen och ska inte pressa spelaren att fortsätta spela eller satsa.

Funktionen ska gå att styra i både Astrids kompakta `/lissabon` och det
större labbet, med samma sparade policy och samma verkliga spelare. Fokus
är Astrid; skapa inga nya dealerflöden. Probe är ett skäl att generera tal,
inte en ny videomapp eller en variant av ett förinspelat idleklipp.

## Börja här och samordna

1. Läs `AGENTS.md`, `docs/JOHN-HANDOFF.md`,
   `docs/ENVIRONMENT-RESTORATION.md`, `lab/docs/README.md`,
   `docs/animation-events/README.md` och `open-claw/lab/docs/README.md`.
   Följ den aktiva systemkartan och relevanta kontrakt därifrån.
2. Arbeta på `jakeminator123/work`. Läs `git status` och senaste commits;
   inventera egna filer innan du börjar. Andra agenter kan arbeta samtidigt.
   Ingen reset, clean, blind pull, mass-staging eller överskrivning av
   sparade projekt, mediamanifest eller andra agenters ändringar.
3. Följ repots inbox- och chefregler. Samordna ägarskap enligt dessa om
   gemensamma filer redan bearbetas. Kontrollera nuvarande Jira CAC-ärende,
   Expected Result och fält före implementation om anslutningen finns;
   rapportera annars begränsningen. Ändra status när arbetet faktiskt går
   vidare. Ingen Jira-anslutning var tillgänglig när uppdraget skrevs.
4. Återanvänd körande lokala tjänster; kontrollera vem som äger portarna
   innan en omstart. Starta inte konkurrerande servrar på 4200/4201.
5. Håll dig till detta checkout och aktiv dokumentation. Läs inte pensionerade
   privata arkiv eller andra lokala kopior. Alla nedanstående sökvägar är
   relativa till detta repos rot.

## Bekräftat nuläge att bygga vidare på

- `lab/components/lissabon-studio.tsx` samlar Ström, Idle, Deal och Repliker.
  Återanvänd editor, lagring och observation från det stora labbet.
- `lab/lib/studio-model.mjs`, dess typdeklarationer, `lab/policies/` och
  `lab/schemas/` beskriver det gemensamma projektet. Idag finns bland annat
  valfria `idlePolicy` och `mediaPolicy`; inför ett kompatibelt Probe-kontrakt.
- `web/player-chat-memory.mjs` lagrar autentiserad spelarkonversation i
  SQLite, avgränsad per spelare och dealer. Gränsen är **12 meddelanden**,
  8 000 tecken och 30 dagars inaktivitet. Det är inte ett separat
  anekdotminne. Begärans idempotens, pågående anrop och glöm-funktionen finns.
- Även `web/openclaw-chat.mjs` och
  `open-claw/lab/src/product-speech.mjs` begränsar historiken till 12.
  Att enbart ändra lagringsgränsen räcker alltså inte.
- Befintlig minnes-`begin()` kräver ett spelarmeddelande och lägger till det
  i historiken. Återanvänd inte detta genom att fabricera ett användarinlägg
  som "probe". Inför ett uttryckligt initiativ/triggerkontrakt.
- Assistentpostens befintliga `generated` betyder genererad, inte att
  spelaren hört repliken. Uppspelningskvitto är ett separat faktum.
- `web/player-results.mjs` ger serververifierade totalsummor från avslutade
  spel. Dessa styrker inte vilka kort spelaren hade eller två identiska
  vinster i följd. Exakta handminnen behöver underlag från avslutade händer.
- Produktens `croupier-speech` får begränsad kontext via servern. Den har
  inte direkt åtkomst till spelarens databas. Operatörschatt, labbkompanjon,
  Director och produktens talroll är skilda ansvar.
- `web/public/astrid-voice-profile.mjs` väljer **Victoria**, Cartesia
  `sonic-3.5`, röst `dc30854e-e398-4579-9dc8-16f6cb2c19b9`.
  Genererat tal använder den befintliga Cartesia → RunPod-kedjan och ett
  verifierbart paket med exakt ljud/video. Återanvänd profilen.

## 1. Enkel gemensam vy och beständig policy

Lägg till **Probe** bredvid Idle, Deal och Repliker i Lissabon. Exponera
samma editor och policy i stora labbet; ingen separat kopia av inställningar.
Gör typen synlig där tal och OpenClaw-kategorier väljs och i händelseloggen.
Koppla den till schema, kontrakt, validering, seed/migrering och guide.
Behåll tekniska event-ID:n för befintliga kategorier.

Den enkla vyn ska innehålla:

- **Av / Textprov / Automatiskt**. Nya och äldre projekt börjar med Av.
- Inställningar för inaktivitetstid och minsta paus mellan repliker.
  Lägg sannolikhet, timtak och minnesinställningar under "Fler inställningar".
- **Prova en probe** med vald syntetisk spelarkontext. Textprov visar vad
  Astrid skulle säga, vilka källminnen som användes och varför hon annars
  var tyst. Inget TTS-/GPU-anrop i textläge. Ett separat tydligt val provar tal.
- En kort minneslista med typ, källa, datum och utgångsdatum, samt "Glöm".
  Använd syntetiska data lokalt; riktig spelarinsyn kräver befintlig korrekt
  behörighet. Skicka inte andra spelares minnen till klienten.
- Senaste beslutet: exempelvis "väntar på lugnt läge", "redan sagt",
  "saknar minne" eller "spelade probe". Visa begriplig svenska i huvudvyn;
  tekniska detaljer kan fällas ut.

Spara med befintligt revisionsskydd. En HTTP 409 ska hjälpa användaren att
läsa in rätt version och bevara sina osparade val. Migreringar får inte
skriva över Idle/Deal/Repliker eller befintliga manuella inställningar.
Läs senaste sparade Probe-policy vid nästa beslut och stoppa inaktuella
väntande initiativ; normalt ska varken devserver eller OpenClaw behöva
startas om för en policyändring. Dokumentera faktiskt beteende.

## 2. Servern avgör när ett initiativ är tillåtet

Föreslagna startvärden, justerbara i labbet:

| Inställning | Startvärde |
| --- | --- |
| Tid sedan senaste chatt eller spelhandling | 90 sekunder |
| Minsta tid mellan probes | 5 minuter |
| Högst per spelare | 3 per timme |
| Sannolikhet per tillåtet inaktivitetsförlopp | 30 % |
| Obesvarade initiativ utan ny spelaraktivitet | Högst 1 |

Sampla en gång per berättigat inaktivitetsförlopp, inte varje timertick.
Ett nej eller tyst svar ska inte ge nya modellförsök varje sekund. En ny
spelaraktivitet kan skapa nästa möjlighet efter gällande cooldown.

Tillåt initiativ bara i en ansluten, närvarande session och ett lugnt
spelläge. Ingen pågående hand/spelarfråga, kortutdelning, annan taluppspelning
eller pågående användarinmatning. Respektera avstängt proaktivt tal och
ljudinställningar. Klientens närvaro/skrivsignal är ett kompletterande
UI-villkor; serverns autentisering och spelstatus är auktoritativa.

Gör billiga kontroller före modell/TTS/GPU. Lås/reservera servermässigt
per spelare så två flikar, omstarter eller dubbla requests inte startar
samma initiativ. Beständig cooldown och idempotens ska fungera efter omstart.
Använd injicerad klocka och slump där det behövs för verifierbara tester.

Ny spelhandling, chatt, utloggning, ny spelare, ändrad policy eller "Glöm"
gör väntande probe ogiltig. Kontrollera igen före kostsamt arbete och före
uppspelning. Avbryt där tjänsten stödjer det; kasta annars ett sent svar.
Spelets handlingar och efterfrågade chattsvar går före en probe. Lägg inte
en gammal probe i kö som spelas långt efter att dess kontext försvunnit.

## 3. Korttidsminne: cirka 30 meddelanden

Använd **30 meddelanden totalt**, användare och assistent tillsammans,
inte 30 hela samtalspar. Behåll ett separat rimligt tecken-/tokenbudgettak
så ett fåtal jättemeddelanden inte driver kostnad eller svarstid.

Uppdatera alla berörda gränser, relay-kontrakt och tester, inklusive
produkt-speech. Dokumentera budget och trunkering. Äldre historik ska
fortsätta fungera; fyll inte ut saknade meddelanden artificiellt.

Skilj användarinitierad chatt från proaktiv Probe. Spara ursprung och
leveransstatus utan att hitta på användarmeddelanden. En genererad men
bortkastad probe får inte senare beskrivas som något spelaren hört.
Förhindra att modellens egna påståenden återvinns som nya personliga fakta.

## 4. Långtidsminne: få belagda fakta i cirka 30 dagar

Utöka befintlig lagring med ett litet separat minne, exempelvis högst
20 aktiva fakta per spelare och dealer. Börja utan en ny vektordatabas.
Varje post behöver stabilt ID, typ, kort innehåll, källreferens, tidsstämplar,
utgångstid och eventuell användning/uppspelningshistorik.

Två skilda källtyper:

1. **Spelarens egna uppgifter**, exempelvis en planerad bröllopsresa.
   Behåll att spelaren berättade detta; använd inte citat, önskningar,
   förnekanden eller frågor som bekräftade händelser. Hantera korrigeringar.
2. **Serververifierade, avslutade spelhändelser**, exempelvis en ovanlig
   hand. Spara tillräckliga referenser för exakt bevis: round/hand-ID,
   relevanta kort, slutresultat och avslutstid. Deduplicera samma event.
   Beräkna faktiska sekvenser med tydlig hantering av split och andra
   delhänder. Avslöja aldrig dolda eller framtida kort.

"Du vann med AhTs två gånger i rad" kräver just det underlaget; totalsummor
eller spelarens obekräftade berättelse räcker inte. Om fakta saknas får
Astrid använda ett säkert namninitiativ eller vara tyst.

Sätt normalt **30 dagars TTL per faktum från skapande eller uttrycklig
återbekräftelse**. En läsning eller att Astrid berättar historien förlänger
inte livet. Resedatum kan göra ett minne irrelevant tidigare. Om spelaren
säger "borta 15 dagar", spara ankaret för tidsangivelsen och respektera
osäkerhet; fråga inte hur hemkomsten var innan den rimligen skett.

Extrahera sparsamt, exempelvis efter 8 nya spelarmeddelanden eller en
relevant avslutad hand. Kör utanför kritiska vägen till ett chattsvar.
Sammanfatta endast tillåtna källor, deduplicera och tillåt noll nya minnen.
Spelfakta kan lagras deterministiskt utan extra modellcall. Modellen får
föreslå strukturerade fakta; servern validerar och skriver, aldrig fri SQL.
Minnen är data, inte instruktioner eller ny behörighet för modellen.

Använd samma kanoniska autentiserade spelaridentitet som dagens chattminne.
Ingen klientvald spelare, inget globalt delat anekdotminne, ingen sammanblandning
med operatörens/labbkompanjonens minne. Befintlig "Glöm" ska också ta bort
dessa fakta, stoppa pågående extraktion/probes och hindra sena svar från att
återskapa raderad historik. Testa med isolerad databas och syntetiska spelare.

## 5. Smalt OpenClaw-kontrakt och skydd mot upprepning

Använd produktens isolerade talroll med ett uttryckligt Probe-läge, eller
en lika snäv roll om arkitekturen kräver det. Koppla inte in operatörens
verktyg eller ett brett minnessök. Servern väljer ett fåtal relevanta,
icke utgångna minneskandidater och skickar bara dessa tillsammans med den
begränsade samtalskontexten och senaste probeämnen.

Validera ett strukturerat svar: tala/var tyst, en kort naturlig replik,
refererade minnes-ID:n och ämnes-ID. Kort normalmål: en mening. Namn måste
komma från serverns betrodda profil. Exempelreplikerna ovan ska inte hårdkodas
som återkommande standardsvar. Språk ska följa befintlig Astrid-inställning.

Skydda mot både ordagranna repriser och samma historia med andra ord:
använd minnes-/ämnes-ID och normaliserad text. Föreslagen spärr för samma
anekdot är 7 dagar; namnkontroll utan anekdot högst en gång per session.
Håll isär reserverat, genererat, avbrutet och faktiskt spelat. Misslyckad
uppspelning får inte bli ett falskt kvitto men får heller inte skapa en
automatisk kostsam återförsöksloop. UI ska kunna förklara varför något tystades.

Behåll hårda gränser mellan spelmotor, klippval och tal. Director väljer
tillåtna klipp; den nya taltypen ger inte modellen rätt att ändra kort,
saldo, utfall, insatser eller annan auktoritativ speldata.

## 6. Victoria, uppspelning och mätning

Använd den gemensamma Victoria-profilen och befintligt genererat talpaket.
Ingen ersättningsröst, längdmatchad inspelning eller loopad munfilm över
ett annat ljud. Ändra inte befintliga godkända mediefiler för detta uppdrag.

Textprov ska kunna granskas snabbt utan lipsynk. Talprov använder exakt
den väg som sedan används i Astrids riktiga spelare. Visa modellbeslut
separat från uppspelningskvitto i båda labbvyerna.

Mät modell, TTS, RunPod-kö, render, överföring och tid till uppspelning
separat. Den tidigare mätningen på cirka 52,9 sekunder avsåg Cartesia →
RunPod utan OpenClaw-anrop; den är inget mått på språkmodellens svarstid.
Behåll provider-/modell-ID och policyrevision i begränsad diagnostik,
men lägg inte nycklar eller riktiga spelares personuppgifter i committade
testresultat. Ändra inte GPU-workers eller driftbudget som bieffekt.

## 7. Kontrollera modell och jämför innan ett byte

Gatewayens env anger **`gpt-5.4-mini` vid kontrollen den 29 september 2026**, se
`open-claw/lab/docs/CLOUD-ACTIVATION-2026-09-29.md`.
Samma modell är lokal seed i `open-claw/lab/deploy/gateway-config.mjs`.
Persistenta Gateway-inställningar kan ha ändrats därefter. Kontrollera
den faktiskt laddade konfigurationen; ett miljöstandardvärde är inte bevis.
Labbkompanjonens separata modell för webbsökning är inte Astrids talmodell.

Jämför på syntetiska identiska fall innan produktmodellen ändras:

- Nuvarande modell som baseline.
- **GPT-5.6 Terra** som kandidat för bättre kvalitet. OpenAI beskriver den
  som motsvarande tidigare mini-klassen med balans mellan kvalitet och kostnad.
- **GPT-6 Luna** som alternativ för ett litet snabbt beslut, om den fungerar
  med aktuell Gateway/provider. Ingen av dessa är på förhand bevisat bättre
  eller lika snabb i vårt flöde.

Kontrollera aktuella officiella modell-ID:n, tillgänglighet, kostnad och
stödda parametrar. Jämför utan reasoning och vid behov låg nivå, där
modellen och Gateway stödjer detta, i stället för att oavsiktligt använda
en långsammare standard. Håll samma prompt, outputbudget och fakta per fall.

Använd gärna 20–30 små fall: namn, verifierad dubbelvinst, saknad handkälla,
resedatum, rättat minne, utgånget minne, glömt minne, upprepad historia och
samtidigt spel. Jämför faktatrohet, naturligt tal, korrekt tystnad,
upprepningar, kostnad och modellens p50/p95; markera osäkerheten i ett litet
stickprov. Mät kallstart separat. Modellval löser inte GPU-kö eller videorender.

Föreslå den bästa verifierade kombinationen. Byt inte andra roller,
fallbacks, behörigheter eller den körande modellen som en dold sidoeffekt.
Dokumentera ett eventuellt valt modellbyte och hur det återställs.

Officiella källor kontrollerade när uppdraget skrevs:

- [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Modellguide](https://developers.openai.com/api/docs/guides/latest-model)

## 8. Verifiering och leverans

Bygg fungerande kedja från sparad policy och serverminne till beslut och
verklig uppspelning. En ny knapp eller en prompt utan runtimekoppling räcker
inte. Prioritera följande verifiering med syntetiska spelare/falsk klocka:

1. Båda labbvyerna sparar/läser samma Probe-policy. Äldre projekt migrerar
   utan att förlora inställningar; samtidiga sparningar hanteras korrekt.
2. Av gör inga modell-/TTS-anrop; Textprov gör inget TTS-/GPU-anrop.
   Automatläge respekterar sannolikhet, cooldown, timtak och obesvarad probe.
3. Två flikar, samma request igen, täta timerticks och serveromstart ger
   inte dubbla initiativ. Inaktivitet innebär inte oändliga återförsök.
4. Ny chatt/hand/utloggning/policy/Glöm stoppar ett väntande eller sent svar.
   Användarchatt fungerar även om en lågprioriterad probe är på väg.
5. 30 meddelanden når hela vägen till talrollen med budgettaket bevarat.
   Ett autonomt initiativ fabricerar inte ett användarmeddelande.
6. Minnen löper ut efter avsedd tid även efter omstart; läsning förlänger
   inte TTL. Korrigering och Glöm fungerar även under pågående extraktion.
   Två spelare kan aldrig läsa eller använda varandras fakta.
7. Exakta kort-/vinstpåståenden kräver motsvarande avslutade serverhänder.
   Obekräftade påståenden, dolda kort, dubbelexporter och split hanteras.
8. Samma berättelse med annan formulering blockeras. Genererat, kastat och
   spelat kan följas i loggen. En spelad probe kan observeras från labbet.
9. Astrid provas i faktisk spelare, inklusive två efterföljande talpaket
   via ett uttryckligt provflöde. Ange vad som visuellt granskats och vad
   som återstår; ett API-svar eller en hash är inget visuellt godkännande.

Kör relevanta tester och build. Vid ändring i media/player, följ dessutom
repots regressionskrav och `pipeline/audit-dealer-sync.mjs --probe`.
Bevara delade uppspelningsvägar. Följ gällande AGENTS-instruktioner för
testomfattning; håll den användarvända demonstrationen till Astrid.

Uppdatera den befintliga labbguiden/ordlistan, kontrakt och handoff med
nya fält, databasändring/rollback, exakta testresultat och kvarvarande
drift- eller granskningssteg. Enbart lokal funktion får inte beskrivas som
verifierad på Render. Redovisa tydligt om behörighet eller anslutning saknas.

Granska diff och stagea endast egna filer. Kontrollera chefstatus före
integration/push och använd `node tools/push-work-mirrors.mjs` enligt repots
regler. Ingen push till main och ingen force-push. Slutrapportera kort på
svenska vad Jakob kan göra i Probe-vyn, vilka standardvärden som gäller,
vilken modell som faktiskt valdes, vad som verifierats och vad som återstår.
