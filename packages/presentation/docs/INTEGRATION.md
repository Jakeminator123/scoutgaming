# Fristående kompositorexport — integrationsreferens

Kompositorkällan finns nu i `packages/presentation/` och används av Studio
och spelruntime enligt [paketguiden](../README.md). Texten nedan beskriver den
fristående referensredigerarens exporter och adaptergränser; den är inte en
instruktion att installera om dagens gemensamma spelare. Referens-UI:t serveras
inte som en separat produkt. Aktuell integration, publicering och mediaformat
styrs av [runtimekontraktet](../../../docs/LOCAL-PRESENTATION-RUNTIME.md)
och [spelguiderna](../../../docs/games/README.md).

En export gör ingen push, deploy, databasändring eller autentisering. Varje
nytt provpaket kräver egen granskning; tidigare användning av kompositorn är
inte ett acceptanskvitto för nya klipp.

PROVORDNING FÖR EN NY FRISTÅENDE EXPORT
1. Importera godkända produktionsklipp, välj en kvalitetsvariant och kalibrera scenen.
2. Exportera ett PROVPAKET. Servera det över HTTP(S) på en isolerad testyta.
3. Testa det på riktiga iPhone/Android-enheter och desktop. Bekräfta kortkontakt, key-kanter, återgång efter skärmlås, nätverksladdning, VILA/REDO och saknade handlingar.
4. Använd dagens gemensamma presentationsväg om provet ska integreras. Ändra inte befintliga mediereferenser eller kalibrerade koordinater utan konsumentkontroll.
5. Kör repots aktuella regression enligt `.githooks/pre-commit` och granska i riktig rehearsal innan en PR bedöms. Läs `AGENTS.md` vid integrationstillfället; äldre index-/synkauditnamn är ingen checklista för dagens registrerade klipp.

VAD WEBBEXPORTEN INNEHÅLLER
index.html / viewer.js / viewer.css: fristående provspelare.
player.js: tillstånd VILA/REDO, två videoelement, klippkö, förladdning och visuella kvitton.
compositor.js: WebGL-komposition, greenscreen, lager och statiska masker. CPU-reserv för lokal granskning när WebGL inte finns.
bridge.js: explicit adapter för presentation[]-typen från services/game/partner-presentation.mjs.
manifest.json: vald variant, klipplista, källmetadata, lager och layouttransformer.
media/: endast vald webbvariant och valda bildlager.
klippinfo.source.json och SHA256SUMS.txt: spårbarhet.

MINIMALT JAVASCRIPT-EXEMPEL (värdsidan behöver en canvas)

import { StudioPlayer } from './player.js';
import { attachScoutGamingBridge } from './bridge.js';

const pack = await fetch('./manifest.json').then(r => r.json());
const player = new StudioPlayer(document.querySelector('canvas'), {
  mediaURL: p => new URL(p, document.baseURI).href,
  onError: message => console.error(message),
});
player.setScene(pack.configuration);
await player.setDealer(pack.dealer, pack.dealer.active_variant);
await player.setAssets(pack.assets);

const bridge = attachScoutGamingBridge(player, {
  boxBase: 0, // Mappa uttryckligen box 0..6 till Emils plats 1..7.
  onReceipt: receipt => console.log('visuellt kvitto', receipt),
  onUnsupported: event => console.warn('värdspelet behöver hantera', event),
});

// Kör efter användarens startinteraktion och efter att den riktiga servern
// har levererat denna lista. Hitta inte på kort eller spelutfall i klienten.
bridge.consume({ roundId: 'serverns-rund-id', presentation: serverResponse.presentation });

// Vid avmontering:
// bridge.detach(); player.destroy();

VIKTIGA GRÄNSER
• Bara servern får bestämma kort, insatser, RNG, regler och utfall. Demoknapparna använder tydliga provkort, inga spelregler.
• Adaptern gör inga fetch-anrop och inget automatiskt byte till en annan runtime/lane.
• to='box' med box 0..6 mappas till 1..7. to='dealer' med faceDown=true kräver deal_poshole. Paow har inte detta klipp; körningen får ett uttryckligt unsupported-resultat.
• shoeDraw används för deduplicering inom ett uttryckligt roundId. Rundbyte återställer spelaren.
• reveal måste komma efter att motsvarande utdelning har spelats färdigt. Adaptern markerar för tidig reveal som unsupported. Värdspelet ska tidsordna den mot queue-idle/card-landed-kvitton; det sker inte automatiskt.
• Tala/lipsync, settle, turn, utbetalningar och split-händer hanteras inte av denna medieadapter. Granska unsupported[] och lämna dessa händelser till värdspelet. Ignorera dem inte tyst.
• Extra kort kan visas som enkla kortstaplar efter landning. Det ersätter inte värdspelets handlayout eller stöd för split.
• card-landed emitteras efter avslutat utdelningsklipp. Det är ett visuellt kvitto, inte en ändring av serverns speltillstånd eller ett exakt fysisk-kontaktbevis.
• Fel eller återanslutning kräver en explicit återställning/resynk från aktuell servervy. Detta paket implementerar inte en återanslutningsmotor.
• Ladda upp medier och metadata med oförändrade relativa sökvägar. Servern behöver video/mp4, image/webp, korrekt JS-MIME och HTTP Range för videoladdning. Kör inte som file://.
• UI:s mobilknapp är en formatförhandsvisning. Den är inte en iPhone-emulator. Den lokala verkstaden binds bara till 127.0.0.1; mobilen testas med det exporterade webbpaketet på en separat HTTP(S)-testyta.
