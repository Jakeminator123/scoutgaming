# S01 · systemen och deras rätta mappar

Bettalottos spelklient, backoffice och det lokala labbet är skilda ytor.
De kan använda samma material utan att samma variantpolicy är aktiverad överallt.

## Produkt och Partner

**Produkt:** `web/server.mjs`, `web/native-table.mjs` och `web/shoe-game.mjs`
hanterar det auktoritativa spelet. Native-klienten får status från `/api/table`
och har sin egen koreografi och befintliga mediespelare. Det accepterade
native-svaret innehåller nu även den publika presentationslistan. Labbet
observerar detta svar från den öppnade spelfliken utan att skicka om kommandot.

**Partner:** `/api/v1/table` kan lämna en presentationslista i HTTP-svaret och
samma instruktioner som `round.events` via SSE. Kanalens nyckel och spelar-ID
måste stämma. En inloggning eller en öppnad spelsida räcker inte som koppling.
Den nya lokala native-bryggan publicerar efter commit till en verifierad
Partner-launch-session. Serveruppdatering och en behörig testsession krävs
innan motsvarande liveväg kan verifieras.

**Backoffice:** katalog, granskning, bindningar och previews. Previewägaren
stoppar föregående media; detta är inte produktens befintliga gemensamma klientkö.
Det äldre rapporterade tvåströmsfelet är inte reproducerat i sin helhet.
Huvudbild och hands-matte är ibland två delar av samma komposit, inte två
konkurrerande videoval.

Kevins MR tillför Generations, swipe och en produktläsare för BO:s
`clipAssignments` via `/api/bo/config`. `neverAgain` filtreras bort. Idle och
stödda staged-takes kan använda valen. Astrids nya V2-väg hoppar däremot över
BO-valen och har filmad utdelning pausad medan korten fortfarande animeras.
`/` behåller originalvägen; `/v2/` väljer Kevins nya Astrid-/Amira-rendering.
En sparad BO-bindning är alltså inte ett generellt bevis på aktiv film.

## Labbet och OpenClaw

**Eventstudion och Videobanken:** projekt, 2D-rörelser, originalförval,
kategorisering, video-ID:n, standard/alternativ, urvalstillåtelser och triggers.
**Händelseloggen:** en läsande jämförelse av originalbild och labbets lokala
sekvensspelare. `Anslut` samordnar öppning, observation och följning.
Native-observern ger kommandomottagning, publik bordsvy samt instrumenterade
playback-/chattsignaler. Partner-SSE är en separat leverans av rundinstruktioner.
**Socialt prov:** Astrid i idle med OpenClaw-svar, avgränsat ljudprov och 2D-gest.
**Operatörschatt:** hjälp om labbprojektet; den är inte spelarchatten.

Den gemensamma beslutstjänsten äger labbets presentationsval. Befintlig
Director/Gateway används; en ny parallell AI-motor behövs inte. Jakobs
OpenClaw-chatt ska bli samtals- och talägare när Kevin integrerar produktvägen.
En fungerande Gateway-anslutning bevisar inte att den integrationen är gjord.

## Scheman, policy och 2D

- `lab/schemas/studio.schema.json`: projekt, linjer, varianter och triggers.
- `lab/schemas/video.schema.json`: kategorisering av uppladdad/befintlig video.
- `lab/schemas/social.schema.json`: socialt labbprov.
- `lab/policies/studio-contract.json`: gemensamma tekniska ID:n, ordlista,
  situationer och möjligheter. `project.seed.json` och `social.seed.json` är
  startvärden, inte levande sparade projekt.
- `lab/animations/`: 2D-rörelser. Dessa är mockupmaterial och bevisar inte
  läppsynk eller kontakt mellan filmade händer och verkliga kort.
- `open-claw/lab/schemas/` och `open-claw/lab/config/catalog.json`: befintliga
  Director-kontrakt och katalog. Driftfrågor börjar i dess `docs/README.md`.

[Labbets artefaktkarta](../../../lab/docs/ARTIFACTS.md) pekar ut ägare,
lagring och ändringsväg. [Talägarskapets implementationsbrief](../../../lab/docs/OPENCLAW-SPEECH-OWNERSHIP.md)
är gemensamt tekniskt underlag, inte ett påstående om färdig drift.

## Video, manifest och lokala data

Produktoriginal ligger kvar under `web/public`. `speech-media.json`,
dealerbankernas `audio/en/bank.json`, `streams/index.json` och Astrids
`performance/manifest.json` har olika uppgifter. Flytta eller kopiera inte
dessa till ett nytt labbregister som sedan börjar leva separat.

Labbet läser originalen genom `lab/lib/original-media-server.mjs`. Egna
uppladdningar sparas i `lab/data/videos/`, klassificering i samma områdes
`classifications.json` och projektkopplingar i `lab/data/project.json`.
`LAB_STUDIO_DATA_DIR` kan ändra dataroten. Lokala data är Git-ignorerade;
en källkodspush delar inte automatiskt Kevin/Emils uppladdade filmer.

Överlämna granskade takepaket via teamets avtalade medielagring och registrera
hash, relativ materialreferens och review i den avsedda produktpipen. Lägg
inte råa spel-/konversationsloggar i Git. Labbet transkodar eller deployar
inte uppladdningen. [Praktisk arbetsgång](s03-eventtradet.md).

## Vad kan provas var?

I labbet kan Kevin/Emil redan lägga in och koppla MP4/WebM, testa villkor,
prova original och OpenClaw-val samt spela importerade sekvenser. I lokalt BO
kan previewägaren provas. Den vanliga lokala spelaren får grenens produktfixar,
men tar inte automatiskt labbprojektets varianter. Allt är alltså inte i BO.

Native-observation kräver spelarkoden i denna arbetsgren, en uttryckligt
öppnad popup och ett loopback-labb. Källa, origin och per-launch-kanal
kontrolleras; credentials och dolda kort redigeras bort. Webbläsarens val av
delad spelflik är fortfarande ett manuellt tillstånd. BO är ett verktyg för
material och konfiguration, inte en rikare alternativ spelmotor.

Live kör den revision och de assets som faktiskt är driftsatta. `main` är
ett branchnamn, inte bevis för dagens liveversion. V5-publicering uppdaterar
dokumentationswebben; den är skild från deploy av spel, BO och Gateway.
