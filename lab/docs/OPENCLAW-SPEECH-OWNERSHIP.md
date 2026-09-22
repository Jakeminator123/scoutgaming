# Implementationsbrief V5: OpenClaw som samtals- och talägare

Status 21 september 2026: beställd produktintegration, inte redan införd runtime.
Jakobs OpenClaw-chatt äger samtal och vad dealern ska säga. Kevin integrerar
och utvecklar den befintliga gemensamma klientkön i web/public/speech-queue.mjs;
Kevin och Emil levererar matchande läppsynk, material och acceptans. Skapa inte
en ny parallell kö eller en andra agent som väljer dialog.

Detta är den delade källan för uppdraget. Den privata mappens gamla promptlänk
pekar hit. [V5-planen](../../docs/animation-events/v5-7-days-mvp/s06-plan.md)
anger omfattning och prioritering. Instruktionerna nedan gäller kommande
implementation; inga föreslagna talfält är ett redan driftsatt API.

**Tillkommet 22 september:** labbets variantkontrakt kan redan föra vidare
begränsad native-chatt som `context.observedChat` (8 meddelanden, högst
600 tecken vardera/3 200 totalt, före eventet och med proveniens). Director
måste kvittera kontextkontrakt v2; äldre remote ger standardreserv tills
redeploy/kompatibilitetsprov är gjort. Detta är variantunderlag, inte
implementation av talbesluten och den gemensamma produktkö som beställs nedan.

Arbeta i det befintliga Croupier-repot på Jakobs arbetsgren. Skapa inte en ny
spelmotor, en parallell app eller ett nytt mediabibliotek. Kontrollera branch,
dirty files och gällande `AGENTS.md`. Bevara användarens env, databas, media,
kalibrering och pågående arbetsändringar. Läs först:

- `docs/JOHN-HANDOFF.md` och `docs/ENVIRONMENT-RESTORATION.md`,
- `lab/docs/README.md`,
- `random-stuff-jakob/jakob-docs/systemkarta/README.md`,
- `random-stuff-jakob/jakob-docs/systemkarta/03-dealers-video-takes/ASTRID-KALLKARTA-OCH-DUBBELSTROM-2026-09-21.md`,
- `open-claw/lab/docs/README.md` och därifrån endast relevanta lokala
  OpenClaw-källor.

## Målet

Gör OpenClaw till den enda ägaren av:

1. samtalspersona och samtalstext,
2. valet mellan en tillåten exakt inspelad replik, ny genererad text eller
   avsiktlig tystnad,
3. ordningen för alla dealer-yttranden i en gemensam talkö.

Servern ska fortsatt ensam äga RNG, sko, kort, regler, legal actions, faser,
wallet, insatser, utfall och utbetalningar. OpenClaw får publika spel- och
presentationsfakta som indata men får aldrig skapa, ändra, förutsäga eller
överstyra dem. UI kan visa serverfakta utan att detta räknas som dealertext.

Använd den befintliga native-klienten, Partner-presentationen, labbmodellen,
OpenClaw Director/Gateway och de gemensamma mediespelarna. Konsolidera de
befintliga ägarna; bygg inte en ersättningsmotor bredvid dem.

## Börja med en faktisk ägarskapskarta

Spåra alla nuvarande talproducenter och konsumenter innan kod ändras:

- deterministiska `voice.say(...)` och `sayLine(...)` i spelkoreografin,
- produktens `/chat`, `AXEL_AGENT_URL`, `VERA_SYSTEM` och eventkommentarer,
- labbets sociala OpenClaw-väg,
- studio-råd för variantval,
- native MP4-tal, indexerad H.264+MP3, packed speech och fri text/ljud,
- captions, mute/visibility, dealerbyte, round transition och avbrott.

Redovisa vilka gamla text- eller line-val som stängs av när OpenClaw-vägen
tar över. Lämna inte två aktiva samtalsägare bakom samma UI. Behåll avgränsad
fallback: om OpenClaw är otillgänglig ska systemet välja tystnad eller en
uttryckligen beslutad säker policy, inte låta en dold äldre agent börja tala.

## Kontrakt för OpenClaws beslut

Återanvänd och utöka repoets befintliga validerade kontrakt så lite som
möjligt. Varje talbegäran ska ha en stabil identitet och bara publika fakta,
exempelvis dealer, språk, källa, request-ID/version/presentationsindex eller
chat message-ID, round/fas, tillåtna line-ID:n och avbrottsscope.

OpenClaw får bara svara med ett validerbart beslut:

- ett exakt `recordedLineId` ur den tillåtna listan,
- en kort `generatedText` inom den sociala policyn,
- eller `silence` med maskinläsbar orsak.

Ett fritt modellvärde får aldrig användas som filväg, event-ID, kortdata eller
speltillstånd. Servern/lokal adapter validerar svaret och materialiserar det
mot befintliga register. Ett okänt line-ID, fel dealer, fel språk, utgången
revision eller motsägelse mot aktuellt event avvisas.

## Inspelade repliker är odelbara paket

Behandla varje inspelad replik som en exakt tuple:

- line-ID och exakt text,
- ljudfil och ljudhash,
- videofil/stream och videohash,
- frame-index, fps och uppmätt audio delay,
- kalibrering/mask/proveniens,
- review/acceptansanteckning och revision.

Välj aldrig talvideo efter ungefärlig längd, känsla eller liknande ord. Byt
inte text ovanpå en gammal läppsynkad film. En ändrad text-, ljud- eller
videohash ogiltigförklarar tidigare visuell acceptans för den ändrade taken.

Om OpenClaw väljer fri `generatedText` får den aldrig spelas med ett gammalt
läppsynkat tal-klipp. Visa den med neutral idle/2D utan påstådd läppsynk, eller
med ett nytt exakt matchat text+ljud+video-paket som har genererats och
granskats inom separat godkänt scope. Rör inte credits eller betald generation
utan uttryckligt tillstånd.

## En gemensam talkö för fyra dealers

Använd en enda köimplementation och samma playback-kontrakt för Vera, Astrid,
Amira och Mei. Kön ska serialisera spelrepliker, chatt, sociala svar och
eventkommentarer. Den ska inte skapa en kö per producent.

Varje jobb behöver:

- idempotensnyckel och källproveniens,
- vald dealer och materialtuple/revision,
- prioritet som inte kan ändra serverns spelordning,
- `AbortSignal` eller motsvarande cancellation owner,
- explicit status: mottaget, valt, laddar, första målade bild/ljudstart,
  klart, avbrutet eller fel.

Avbryt och städa säkert vid dealerbyte, navigation/unmount, dold flik enligt
produktpolicyn, mute, ersatt chattsvar, stale round/version och mediafel.
Ett avbrott får inte starta nästa jobb två gånger eller lämna audio, video,
Blob-URL, decoder, timer, caption eller performance-lager aktivt.

## Deduplicera två leveransvägar

Partner-kommandon kan bära samma `presentation[]` i HTTP-svaret och SSE.
Native-launchen kan publicera native-kommandot till Partner-SSE efter commit.
Korrelera på kanal, request-ID, tabellversion och presentationsindex plus
kanoniskt innehåll. Samma instruktion får ett presentationsjobb med flera
leveranskvitton. Olika innehåll på samma identitet ska blockeras och loggas,
inte spelas i valfri ordning.

En retry, dubbelt klick, återanvänd request-ID, återanslutning, två
EventSource-instanser eller flera observatörer får inte ge dubbel playback.
Serverns accepted/committed resultat och presentationens idempotens ska vara
separata men korrelerbara. SSE har ingen replay i dagens kontrakt; fyll inte i
luckor.

## Kvitton måste komma från verklig uppspelning

Skilj följande i logg och test:

1. serverkommando accepterat/committat,
2. presentation mottagen och deduplicerad,
3. OpenClaw-beslut validerat,
4. medietuple upplöst och laddad,
5. första bild faktiskt målad och ljud faktiskt startat,
6. cue/landning observerad,
7. uppspelning avslutad, avbruten eller felad.

Ett line-val, en fetch 200, en waveform, ett hashpass, `speech end` efter fel
eller en modelltext är inte ett playbackkvitto. Bevara actualPlayback=false
tills spelaren själv lämnar kvittot. Logga inga tokens, signerade URL:er,
privata kort eller fullständiga konversationsexporter.

## Tester som måste finnas före handoff

Använd isolerad server/databas och ett annat hostname för gameplaytester.
Manipulera inte verklig användardata eller wallet. Lägg fokuserade tester för:

- samma Partner-presentation via HTTP+SSE ger ett köjobb och två deliveries,
- native-publicering sker exakt en gång efter commit,
- duplicate request/retry/stale version/rollback/failed commit ger ingen ny
  publicering eller playback,
- dubbla prenumerationer och flera flikar kan inte starta samma lokala jobb
  två gånger,
- chatt och deterministisk speltrigger samtidigt serialiseras i samma kö,
- cancellation före start, under load, efter första frame och under audio,
- generated text kan aldrig välja ett gammalt inspelat mouth clip,
- tuplehash/revision och exakt text måste matcha innan inspelat tal startar,
- alla fyra dealers går genom samma kö och städväg,
- fel, mute, visibility, dealerbyte och unmount lämnar noll aktiv media och
  exakt ett terminalt kvitto,
- två på varandra följande plays startar och avslutas separat utan gammalt
  frame/audio-state.

För varje media/player-ändring: kör `node pipeline/audit-dealer-sync.mjs --probe`
och testerna i `.githooks/pre-commit`. Granska alla fyra dealers i faktisk
rehearsal-väg, inklusive två plays i följd. Hash- och testpass är inte
läppsynkacceptans.

## Dubbelströmskontrollen i backoffice

Backoffice har en liten gemensam preview-controller för klipp och talmedia.
Bevara och testa att en ny start pausar och återställer föregående preview,
och att rerender/navigation/pagehide släpper dold media. Vid återkomst från
BFCache ska `pageshow` återrendera aktuell sektion så att släppta previews åter
får fungerande källor. Låt inte en framtida ombyggnad återinföra flera
samtidiga katalogpreviews. Ändra inte produktens livebindning som en bieffekt.
Dokumentera separat att engine huvudbild+matte är ett synkat kompositpar och
inte två konkurrerande takes.

## Leveransgräns

Arbeta lokalt tills implementation, tester och dokumentation är granskbara.
Deploya inte, publicera inte, ändra inte riktiga konton och starta inte betald
media-/röstgenerering utan uttryckligt godkännande. Om ett aktuellt Jira CAC-
ärende finns, läs hela Expected Result och custom fields och följ projektets
statusflöde. Slutrapporten ska ange exakt vad OpenClaw nu äger, vilka gamla
ägare som är avstängda, testade kvitton samt kvarvarande live- och visuell QA.
