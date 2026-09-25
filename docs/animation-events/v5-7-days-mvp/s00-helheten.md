# S00 · vad vi har byggt och vart vi går

V5 samlar arbetet på Jakobs arbetsgren. Vi bygger vidare på det fungerande
labbet och produktens befintliga spelare. Sju dagar efter startgrinden D0 är en arbetsram med
kontrollpunkter, inte ett löfte om produktionslansering.

## Kedjan i en minut

Servern drar kort och avgör regler, tur, saldo och resultat. Därefter beskriver
presentationen vad klienten ska visa: exempelvis dela ett kort till plats 3,
spela repliken `blackjack` eller gå till vänteläge. Spelaren komponerar film,
ljud, kort och bord. Hela handen är inte en enda färdiginspelad video.

Labbet kan nu spela samma mottagna instruktioner med registrerade original,
egna varianter eller 2D. OpenClaw får välja bland tillåtna presentationer.
Det är en separat uppspelning av samma instruktioner, inte en kopia av den
ursprungliga klientens faktiska bild- och ljudtidslinje.

## Byggt lokalt idag

- **Originalförval:** standard utan egen videokoppling hittar material för exakt
  dealer, replik eller stödd destination. Egen koppling går före. Alternativ
  lånar aldrig standardens film eller inspelade tal.
- **Tal-klippen är nåbara:** Astrid har 17 tal-klipp: tre egna talnoder och
  14 val under Övrig spelreplik. Tur/resultat är spelmarkeringar; resultattalet
  hör till ett separat `speak`, så samma fras ska inte läggas på båda.
- **Händelselogg och sekvenser:** Anslut samlar session, läsande observation
  och automatisk följning. Originalbild och labbpresentation visas sida vid
  sida; manuell flikdelning är ett separat webbläsartillstånd. Native-svar och
  klientsignaler kompletterar SSE. Diagnostik samlar import/export och verktyg.
  Varje sekvenssteg öppnar befintlig editor.
- **Gemensamt presentationsbeslut:** Eventstudion och sekvensspelaren använder
  `/api/presentation/decision`; `/api/simulate` är en kompatibilitetsadress.
  Beslutet visar faktisk beslutsägare och återanvändning. Felbundna alternativ
  tas bort före urvalet.
- **Utanför labbet:** native-kommandon kan publiceras till rätt Partner-kanal
  efter transaktionscommit. Backoffice har en gemensam previewägare som städar
  föregående ljud/video. Isolerad datamapp finns för lokal produkt-QA.
- **V5-komplettering:** uppladdning/kategorisering tillåter nu även de sju
  tidigare saknade grundreplikerna, bland annat greeting, peek och bust.
  Exakt replik krävs fortfarande; inga tekniska event-ID:n byts.

## Det aktiva mediemanifestet

Den aktuella produktkällan är `emil/dealklipp-v1/lab-video-manifest.json`,
schema 2. Den har **31 poster i 26 familjer**: åtta deal-familjer, sjutton
speech-familjer och en idle-familj. Dealern och exakt semantik väljer familj;
vikt anger relativ urvalsegenskap, inte uppmätt faktisk andel.

Box 0–6 mappar exakt till `deal_pos1`–`deal_pos7`. Tal väljs med exakt
line-ID. Idle har två standardtagningar och fyra varianter; de är en annan
struktur än en standard plus högst fyra alternativ i labbets projektmodell.
Det externa generationsarkivets 224 historiska poster är inte längre normal
runtimekälla och ska inte summeras med manifestet.

## Beställt nästa steg

**Jakobs OpenClaw-spår ska äga samtal och vad dealern säger.** En separat
`openclaw/croupier-speech`-roll och en tunn Director-adapter för
`/api/product/speech` finns och har passerat lokala kontraktstester. Befintlig
OpenAI-koppling är kvar; detta är inte ett byte till Gemini. Privat transport,
token, redeploy och prov i faktisk runtime återstår, så gamla produktvägar är
ännu inte ersatta i drift. Modellen äger aldrig spelet.

## Minsta rimliga sprintleverans

En spårbar kedja med ett inspelat talpaket, ett alternativ med trigger och
ett chattprov genom gemensam kö i isolerad runtime. Den ska visa exakta
källfakta, beslut, material och verkliga start/slut/avbrott. Alla fyra dealers
behåller den gemensamma spelarvägen. Läppsynk bedöms per take med öga och öra.

Full plats-/splitkontakt, all fri läppsynkad dialog och komplett livehistorik
ryms inte automatiskt i denna minsta leverans. Saknat underlag ska förbli en
synlig lucka. [Plan och ansvar](s06-plan.md) anger hur vi prioriterar.
