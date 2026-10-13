# Roulette: signaler, filmfack och tre lager

Kodgrund kontrollerad 13 oktober 2026 på `54522581`. Tilläggen nedan hör till
`codex/roulette-clip-map`; detta är inte ett kvitto på produktionspublicering.
[Spelmanual](README.md) · [Motorkontrakt](TEKNIK.md) · [37 kompakta utfall](UTFALLSFILMER.md).

## Ägarskap och separation

En person, exempelvis en känd dealer, behåller samma dealer-ID i båda spelen.
Blackjack och roulette har egna filmfack, händelsekartor och bordsgeometrier.
Ett filnamn, personnamn eller lika lång film gör inte klippen utbytbara.
Roulette registreras med `game: roulette` och exakta `roulette.*`-fack;
blackjackens `idle.ready`, `speak.goodluck`, givning och skosekvenser får inte
användas som roulette-reserv. Uppsättningsnamn (`dealerSets`) väljer inte spel.

Bakgrundsfiler kan återanvändas. Rum behåller bolagets ägarskap, behörigheter
och speltyp; samma bakgrund gör inte två sparade rum till samma rum. Bord
registreras med ett beständigt spelval. Äldre otaggade bord behålls för
blackjackkompatibilitet men räknas inte som roulettebord. Kända designhashar
kan inte märkas om. Se [gemensamma ordlistan](../../../lab/docs/TERMINOLOGI.md).

## Faktiska signaler och föreslagen reaktion

| Källa | Finns idag | Presentation |
| --- | --- | --- |
| Rummet öppnas, `op: state` | Serverläget läses; ingen buy-in | VILA/idle, valfri hälsning |
| Marker läggs, tas bort, ångras, återläggs | Lokalt utkast; ingen debitering eller motorsignal per klick | Behåll idle; eventuell kort bekräftelse begränsas i frekvens |
| Spela, `op: spin` | Samma requestId/version/valuta/satsningar sparas före anropet | Lås kontroller och vänta på kvitto |
| `roulette.spin.resolved` | Serverevent i ett redan sparat rundkvitto, nummer/färg samt avräkning | Dagens resultat är redan offentligt; ger ingen hemlig filmfas |
| Accepterad satsning / pending | Föreslaget kontrakt, saknas idag | Starta neutral dealer-/hjulrörelse en gång per spelar-/rumsscope och rund-ID |
| Serverns reveal | Föreslaget kontrakt, saknas idag | Frigör utfallet och välj korrekt avslut; spärren gäller även saldo/historik |
| Kulsläppsruta | Behöver kalibreras i rätt filhash | Släpp en kula i hjulspåret; utfallsberoende avslut först efter serverns reveal |
| Filmens stopp/resultatruta | Behöver implementeras | Håll rätt slutbild; resultatannonsering och eventuell nettoreaktion |
| Ny runda | Personliga rundor, ingen gemensam nedräkning | Tillbaka till kompatibel vila |
| Utträde | Ingen separat cash-out i roulette | Valfritt farväl vid ordnat utträde; flikstängning garanterar inget klipp |
| Nät-/mediafel eller återläst kvitto | Exakt återförsök finns | Samma runda, aldrig ny dragning/debitering; textresultat om film saknas |

`round.wagered`, `returned`, `net`, `balanceAfter` och valuta kommer från
servern. `roulette_bet` och `roulette_payout` är bokföringsposter, inte två
fristående klienttriggers. Återbetalning kan vara större än noll trots negativt
netto. Filmavslut får aldrig ändra pengarna. Gemensamt demosaldo delas med
blackjack; externa partnerkontons rouletteplånbok stöds inte ännu.

Föreslaget flöde, **inte dagens direkt avgjorda API**:

```text
Öppna rum → VILA/IDLE → placera marker → SPELA
                                         ↓
                              accepterad satsning / pending
                                 ├─ DEALER: impuls + kulsläpp
                                 └─ HJUL: neutral snurr, en kula
                                         ↓
                              SERVER REVEAL: offentligt utfall
                                         ↓
                              ett av 37 kalibrerade avslut
                                         ↓
                              slutbild → resultat → VILA
BAKGRUND: separat tyst bild/videolager genom scenen
```

[Asymptote-källa](underlag/roulette-filmflode.asy). Filmen får ingen sekretess
genom att bara dölja ett redan mottaget resultat.

## Klippkartan och uppladdning

Öppna `/admin/clips`, välj bolag, **Roulette**, rum och dealer. Korten går att
flytta och har egna förhandsvisningar. Sparade blackjacklinjer ändras inte.

| Kort | Fack och filtyp | Vad verktyget gör |
| --- | --- | --- |
| Vila | `roulette.reference/VILA`, PNG med alfa | Lokalt bildprov; native-registrets PNG-lagring är fortfarande spärrad |
| Vänta | `roulette.idle/breathing`, MP4/WebM | Registrerar dealer-idle |
| Vänta, variant | `roulette.idle/glasses-clean`, MP4/WebM | Registrerar lugn variation |
| Starta | `roulette.wheel-start/wheel-start`, MP4/WebM | Registrerar hjulgest, initialt overifierade poser |
| Insatser | Välkommen, lägg insatser, inga fler insatser | Planerat roulette-talset; ingen falsk koppling till blackjacktal |
| Hjul | 37 slutlägen och resultatstillbilder | Planerad versionsbunden bank; inte en vanlig loopande bordsfilm |
| Resultat | Nummer/färg, nettoreaktion, återgång | Planerad spel- och talstyrning |

**Registrerat är inte spelkopplat.** De tre videofacken använder befintlig
native-upload med servergrindar för roulette/alfa. VILA-bilden provas bara
lokalt och sparas inte; beständig dealer-PNG kräver lagringsmigration.
Övriga kort visar nästa
steg och har ingen uppladdningsknapp innan deras exakta kontrakt finns.
Valet **Bakgrund och bord · bild/video** öppnar den gemensamma mallen;
panelen listar vilka rum en malländring berör. Rummets egna val använder det
befintliga rumsbundna flödet.

Bakgrund och scenbord stöder PNG/JPEG/WebP samt MP4/WebM. Dealer stöder grön
MP4 eller verifierad alfa-WebM; lokalt VILA-prov använder PNG. MIME bevaras vid
förhandsvisning. Bordsvideo är scenmaterial, inte en godkänd utfallsbank.
Händer framför bord kräver granskad mask och samma tidsregistrering.

Saknas VILA visar editorn första tillgängliga, korrekt registrerade idle för
**samma dealer och roulette**, stabilt sorterad på media-ID. Detta är en
förhandsvisningsreserv, inte visuell acceptans eller automatisk publicering.
En framtida publicering måste låsa valt ID/hash och en granskad stillruta.
Saknas även idle lånas inget blackjackklipp.

## Materialinventering

Underagentens kontroll av källkod, metadata och befintliga dokument gav:

| Material | Evidens och destination |
| --- | --- |
| `web/public/roulette/assets/roulette-bord.png` | Lokala bytes matchar metadata: 2 229 281 byte, SHA-256 börjar `dcf2fe0e`. Prototyp med kända sifferfel; inte produktionsgodkänt |
| Anna VILA | Dokumenterad privat PNG → referensfacket |
| `runway-idle-alpha.webm` | Dokumenterat privat 1916×1080, 10,042 s → andningsvila |
| `runway-glasses-alpha-v2.webm` | Dokumenterad glasögonvariation → eget idle-fack; v1 är underkänd |
| `spin_transparent.webm` | Dokumenterad 1080×1920-hjulgest → hjulstart; handträff fortfarande felkalibrerad |
| `runway-bg-source.mp4` | Dokumenterat bakgrundslager; annan bildkvot kräver matchande poster |
| `runway-table-source.mp4` | Underkänd geometri; får inte fylla ett utfallsfack |
| 0–36-banken | Ingen verifierad komplett bank eller spelkoppling |

Den första inventeringen ovan byggde på dokumentation. De nu uttryckligen levererade originalen har därefter öppnats och verifierats enligt nästa avsnitt; de har inte flyttats eller produktionsgodkänts.
Detaljer och tidigare privata prov finns i [materialavsnittet](README.md#faktiskt-producerad-startuppsättning).
De fem kända blackjackborden ska ligga kvar som separata blackjackdesigner.
Ingen fysisk omflyttning behövs; problemen gäller felaktiga kopplingar och
otydliga speltyper. Bildens dealertext bevisar inte vem en fil föreställer.

## Återstår före spelkoppling

Publicerade bord som bild/MP4/WebM kan nu användas som scenlager i
`/play/roulette`: giltigt spelarval → rummets standard → första tillåtna
publicerade bord. Om inget finns används prototypen. Publicerade bord behåller
sin geometri och får inte prototypens handmask. Bordsvideo här är en loop,
inte en serverstyrd utfallsfilm. Bakgrundsvideo stöds också som separat lager.

- Eget fryst roulettekontrakt för val av dealer-idle/handlingar och bankrevision.
  Den publicerade `idle.ready`-kopplingen är blackjack och exponeras inte för roulette.
- Sekvenskö med prioritet, samma rund-ID vid återförsök, säker avbrytning vid
  kontobyte och dubbleringsskydd. Markerändring får inte starta hjulgesten.
- Hashbunden pose/handmask/kulsläppsruta, full 37-bank och slutbilder.
  Nuvarande gemensamma scenrenderare loopar video; utfallsfilmer behöver
  separat engångsspelare som håller slutrutan.
- Separat roulette-talset med exakt text, ljud, video och lipsyncacceptans.
- Två sammanhängande spelningar i riktiga spelaren, mobil/desktop, reducerad
  rörelse, mediafel, tappat kvitto och omladdning. API-test är inte visuell acceptans.

Nya spelmärkta bord kräver motsvarande runtimekapabilitet före registrering
och publicering. Ingen produktion, databas eller lagrad fil har ändrats av
att detta dokument och verktygsförslag levereras.

## Nya lokala original, 13 oktober

Verifierat direkt i `Desktop/videoskapare/roulette`; relativa namn nedan avser den katalogen. Alla fyra videor är ljudlösa, 1916×1080 och 24 fps. Exakta bytes/hash är identiteten; ett liknande filnamn ger inget godkännande.

| Fil | Byte / längd | Rätt destination och kontroll |
| --- | --- | --- |
| `bord/videos/roulette-bord-start-stop.mp4` | 10 317 238 / 15,041667 s, 361 rutor | Bord-/hjulprototyp. Nummerkransen är inte verifierad; ersätter inte en korrekt 37-bank |
| `croupier/idle/idle.mp4` | 3 629 162 / 10,041667 s, 241 rutor | Bevara som källfilm; H.264 saknar alfa, svart får inte antas vara transparent |
| `croupier/idle/idle.webm` | 897 456 / 10,042 s | `roulette.idle/breathing`. Hash matchar dokumenterad andningsvila; avkodade alfaprov har både 0 och 255 |
| `croupier/idle/variant/anna-variant-idle-eyes.webm` | 826 571 / 10,042 s | Glasögonhandling, inte bara ögonvariant. **Underkänd alfa:** provrutor är helt opaka trots alfamarkering. Hash matchar tidigare underkänd v1 |
| `croupier/idle/Anna-Joihnson-VILA.png` | 603 108 / 1672×941 RGBA | Rätt befintlig sökväg till referensbilden. Den angivna sökvägen under `bord/videos` finns inte |

SHA-256 i samma ordning:

- Bord: `7702cec6f0ec5ec2e1767608781588e8f6b182a0fbc652a952706f8288314195`.
- Idle MP4: `b89a56277d7bf08e993997f4bd71f5d13692fb0f32d818e2fb53156ec7ea2eda`.
- Idle WebM: `02700429c0536003694dd0e595f3b5d5864bf12e580c0539c252f1793d8a1a34`.
- Eyes/v1: `b6025b2cad75cb82406f29a8b116fe44957b013cf1de25b11cf9983d312cd224`.
- VILA PNG: `bb91fc8a9fc9e1e749d68c0d1b38d7dfac1a781663dcc586e93527ac86ceb737`.

Den redan korrigerade `runway-glasses-alpha-v2.webm` återfanns i det uttryckligen dokumenterade privata provet från 12 oktober: **2 438 993 byte**, SHA-256 `f64d2b014bb28704ed99d5f220268466b4153fc489044eb6204a16aa647ffcb4`. En separat leveranskopia heter `anna-glasses-clean-alpha-v2.webm` i det nya `roulette-stop`-provet. Alla **241 avkodade rutor** har både helt transparenta och helt opaka pixlar. Detta verifierar användbar alfaomfattning, inte fina kantdetaljer, handkontakt eller en godkänd viloskarv. Koppla denna hash till `roulette.idle/glasses-clean`; använd inte eyes/v1 som reserv. Ingen ny generering behövdes och originalet skrevs inte över.

Föreslagen prioritet: behåll befintlig vila, använd rätt glasögonfil efter visuell granskning, lås korrekt hjulgeometri och beställ separat kulsläpp/hjulimpuls. Därefter kan en kort blick/smile-variant läggas till. [Utfallsplanen](UTFALLSFILMER.md) beskriver masker, 37 mål, OpenClaw-spärrar och resultatsekretess.
