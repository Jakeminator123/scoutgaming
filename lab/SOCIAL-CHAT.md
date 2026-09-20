# Astrids sociala chattprov

Chatten sitter direkt under bordet i **Eventstudion**, före eventtestets
inställningar. Den är synlig även när en annan nod är vald. Välj då
**Gå till Astrids vänteläge** för att aktivera fältet. Detta är ett lokalt
spelarchattprov. OpenClaw-sidans operatörschatt och eventtestets simulerade
chattsignal är separata flöden.

## Ett svar i idle

Ett meddelande ger ett fritt textsvar. **Ljud** är förvalt och låter
ElevenLabs läsa exakt samma text; avmarkera det för enbart text. Scenen visar `idle.ready.standard`. Modellen kan fortfarande föreslå
exempelvis `social.ledsen`; förslaget loggas men startar ingen hand- eller
kroppsrörelse under svaret. Vanliga idle-blinkningar avbryter inte talet.

Socialt prov får bara börja när Astrid väntar och ingen annan preview äger
scenen. Handlingsprov spärras medan det sociala anropet eller talet pågår.
Detta är lokal samordning, ingen färdig eventkö i produktens spelare.

- **Högst sex sekunder tal:** ljudets metadata kontrolleras före start. Ett
  för långt ljud avvisas; textsvaret finns kvar. En tidsvakt stoppar ett ljud
  som ändå passerar gränsen och loggar det som ett misslyckat prov.
- **En uppspelning:** inget automatiskt omtag eller loop. Knappen för att
  spela sparat ljud igen är ett nytt, uttryckligt manuellt prov.
- **Tydligt stopp:** stoppknappen, byte från aktuell scen, sidbyte eller dold
  flik avbryter pågående prov. Ett sent svar får inte återstarta ljudet.
- **Ingen läppsynk godkänns:** den neutrala 2D-scenen är en illustration.
  Riktig läppsynk och integration med produktens gemensamma spelare återstår.

## Vem beslutar?

Chatt → sparad lokal social policy → Director → OpenClaw `croupier-social`
→ lokalt validerat svar → text och valfritt lokalt ElevenLabs-tal.

Modellen får kontraktet `choose_social_response`: text och ett uttrycks-ID
eller inget uttrycksbyte. Det är validerad JSON, inte en installerad MCP-tool.
Serverns policy kan hålla tillbaka ett uttryck under cooldown. I fritt läge
fortsätter text och tal ändå; pausen gäller bara uttrycksvalet. I läget med
fast standardfras hålls även den upprepade frasen tillbaka som tidigare.

**Händelseloggen** visar begärans ID, vald policyrevision, modellens förslag,
faktiskt visat idle-material samt ljudets laddning, start, slut, fel eller
avbrott. Förslag och uppspelning är separata steg. Loggen är tillfällig i
fliken, högst 150 poster; omladdning tömmer den.

## Policy och röst

`social.ledsen` heter **Ledsen** från början. Namn, instruktion, tröskel,
cooldown och fast replik går att redigera separat från eventprojektet.
**Fritt svar** är standard och låter modellen formulera texten oberoende av
om Ledsen föreslås. **Standardfras när uttrycket triggas** är ett valbart
undantag för en återkommande replik. Vanliga frågor besvaras fritt även i
det läget när uttryckets villkor inte matchar. Tröskeln avser modellens bedömning,
inte en uppmätt känsla hos spelaren. Sparade projekt migreras inte automatiskt.

Tal är förvalt men skapas först när du skickar och kan kosta ElevenLabs-krediter. Samma exakta
text/röst/modell kan återanvända ljudcachen. För långt genererat tal kan
avvisas efter att det skapats; sexsekunderskontrollen är ingen kostnadsgräns.
Det görs ingen automatisk regenerering. Inspelade produktvideor används inte
med nya ord utan ett matchande granskat talpaket.

## Uttrycksvideo är en separat uppgift

Den sociala vägen har i dag Ledsen eller neutralt idle som tillåtna uttrycksval.
Den väljer inte fritt bland alla Eventstudions videovarianter. Kö, exakt
koppling till ett socialt videoklipp och start vid nästa grundposition återstår.
Med nuvarande regel om tal enbart i idle måste ett separat uttrycksklipp
och talet köras i följd. Ett klipp med inspelad munrörelse kan inte få
godtyckligt nya ord utan fungerande läppsynk.

## Filer och lagring

- `policies/social.seed.json` och `schemas/social.schema.json`: startpolicy
  och format; servervalidering finns i `open-claw/lab/src/social.mjs`.
- `data/social-policy.json` och `data/social-history/`: lokala inställningar
  och revisioner, utanför Git.
- `lib/social-playback.mjs`: en talägare, sexsekunderskontroll och stopp.
- `animations/social-reactions.json`: tidigare syntetiskt uttrycksmaterial.
  Den sociala svarsvägen väljer nu neutralt idle vid visning.
- `data/voice-cache/`: exakt text/röst/modell/hash och MP3, utanför Git.
- `test/social.test.mjs` och `test/social-playback.test.mjs`: lokala tester
  med simulerade leverantörer och ljudobjekt.

Samtalshistoriken är begränsad i labbpanelen. Director får den med varje nytt
prov i en separat social session; inget beständigt spelarspecifikt minne har
byggts. Gateway kan skriva sina vanliga sessionsloggar. Cooldown och
dupliceringsskydd är lokala serverprocesskontroller, inget produktionslås.

`LAB_REMOTE_URL`/`LAB_REMOTE_TOKEN` används lokalt, `LAB_API_TOKEN` på
Director och befintlig modellnyckel på Gateway. ElevenLabs-nyckeln läses på
den lokala servern. Befintlig blueprint är `open-claw/lab/render.yaml`.
