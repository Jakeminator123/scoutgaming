# Agentuppdrag: återge observerat videoflöde som 2D-mockup

Arbeta i Croupier-repot på Jakobs arbetsgren. Kontrollera faktisk branch,
dirty files och repo-/labb-AGENTS.md först. Bevara användarens projekt, env
och media. Läs senaste kompletteringen i
[handoffen](HANDOFF-2026-09-21-LIVE-OCH-2D.md),
[användarguiden](../../lab/docs/README.md),
[gemensam handoff](../../docs/JOHN-HANDOFF.md) och
[miljöåterställningen](../../docs/ENVIRONMENT-RESTORATION.md).

## Målet

2D är en mockup av det som ska vara videofiler. Återskapa originalspelets
observerade presentation: korrekta kort, boxar/händer, klippordning, repliker,
kortlandning, pauser och återgång till idle. Använd samma serverägda speldata.
Utöka i första hand den befintliga Partner-ytan `/activity`; skapa ingen
parallell motor eller separat ny app.

## Börja med beviskedjan

1. Läs Kevins [API- och videobesked](https://gitlab.com/scout-gg/croupier/-/work_items/1#note_3873260823).
   `/activity` kan verifiera Partner-scopes, ansluta SSE, öppna originalspelet
   med samma nyckel/spelare, hämta mapping och exportera observationsprotokoll.
   Nuvarande nyckel har launch/events, inte play/wallet. Liveöppningen visade
   saldo 0,00 €. Ordna avsedd demomiljö innan rundprov; manipulera inte en riktig
   spelares databas, wallet eller saldo för testet.
2. Kontrollera först att en verklig runda från launch-klienten faktiskt kommer
   i SSE. Detta är inte verifierat: Kevin beskriver stödet, medan hämtad
   serverkod visar publicering från Partner-table men ingen native-brygga.
   Om den saknas, redovisa det konkreta glappet. Bygg ingen låtsaström.
3. Korrelera spelkommando/svar med presentation och faktiskt renderat klipp.
   Läs native `/api/table`, Partner `/api/v1/table`, `web/partner-presentation.mjs`,
   klientens koreografi och den gemensamma videospelaren. Mapping är material
   och BO-bindningar, inte bevis för faktisk uppspelning. Start/slut, filhash,
   route, clip-ID och kortlandning måste komma från spelaren eller en dokumenterad
   observation. Spara endast avgränsat underlag utan auth-data.
4. Börja med två på varandra följande sekvenser av start/hit/stand/collect.
   Utöka sedan till reveal, split, double och försäkring med isolerade,
   deterministiska testfall. Fyll inte i osynliga kort eller saknade tidsstämplar.

## Bygg mockup och varianter från detta underlag

- Inventera befintliga `lab/animations`, index, scheman, motion-player och
  variantbindningar innan nya filer skapas. Biblioteket har 64 gemensamma
  rörelsefiler för 256 dealer/event-varianter. Samma asset kan därför återkomma.
  Nyskapade alternativ kan dessutom kopiera standardens assetId.
- Skilj felaktigt urval, fel assetId och faktisk avsaknad av rörelse. Att döpa
  en variant till ”långsamt” ändrar varken fil eller timing. Befintligt format
  har normaliserade keyframes och `durationMs`, men ingen generell per-variant-
  tidskontroll i editorn. Inspektera faktisk sparad bindning, inte bara seed.
- Lägg vid behov nya, granskbara kandidater i en undermapp till
  `lab/animations`, med det befintliga schemat och registrering i index.
  Varje kandidat ska ange vilken referens/sekvens den efterliknar, exakt dealer,
  event, destination, längd, kontakt/landning och start/slutpose. Märk luckor.
- Återanvänd samma rörelse när endast tempot skiljer, men gör längden explicit
  och håll kortkontakt/landning synkroniserad. Ändra aldrig produktens talvideo
  eller ljudhastighet som genväg. Annan handväg, riktning, pose, känsla eller
  avslut kräver en faktisk skillnad i rörelsedatan.
- Använd serverns kort, box, handIndex, shoeDraw, fas och legalActions. Håll
  timing, variantval och renderingskvitton separata. Deduplicera samma kommando
  om det observeras både i svar och SSE. Avbrott är luckor, inte replay.
- För ett observerat förlopp ska scenen kunna visa vad som mottogs, varför
  materialet valdes och vad som verkligen började/slutade. Låt ett klipp
  kunna ersätta motsvarande mockup utan ändring av spelregler eller kortdata.
- Inspelat tal kräver exakt text, audio, video, frame-index och kalibrering.
  Välj inte talvideo efter ungefärlig längd. Bevara alla fyra dealers på samma
  playback-väg; följ repoets mediaregression om den ändras.

## Leverans

Visa den fungerande sekvensen på befintlig labbyta och koppla varje påstående
till observation eller test. Separera verklig observation från simulerad
fixture och mapping från faktisk playback. Spara inga tokens, launch-länkar
eller privata konversationer. Uppdatera handoff och användarguide, kör relevanta
tester, committa endast egna filer och koordinera enligt chef-status före
delad integration/push. Följ Jira CAC om ett aktuellt ärende finns tillgängligt.
Slutrapporten ska tydligt ange vad som fungerar, vilket underlag som finns
och vilka övergångar/takes som fortfarande inte är verifierade.
