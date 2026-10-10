> Safety update (26 September 2026): live chat now selects a fixed reviewed response before speech. Free-form streaming and arbitrary `/api/speak` text are disabled. See [BMM preparation](BMM-PREPARATION.md) for current controls, verification and open items.

# Astrid lipsync-demo 2.0

Ett delat blackjackbord där flera personer chattar med dealern **Astrid** samtidigt. Hon svarar med röst och
läppsynkad video som genereras i stunden, på spelets riktiga startbild. Mellan svaren lever hon (idle-klipp), och
hon spelar spelets förproducerade repliker och kortutdelningar. Byggt för att testas lokalt och sedan kopplas in i
Croupier-spelet — se **[INTEGRATION.md](INTEGRATION.md)**.

Uppmätt från skickat meddelande till färdigt läppsynkat klipp: **~4 sekunder** (varm GPU).

```
spelarens text
  → Gemini (strömmad)                svarstext, ord för ord             ~0,8 s
  → Cartesia, rösten Freja           röst medan texten skrivs            +0,6 s
  → MuseTalk på RunPod Serverless    läppsynk på startbilden, NVENC      +2,5 s
  → mp4 till ALLA vid bordet
```

---

## Innehåll

1. [Igång på tre kommandon](#igång-på-tre-kommandon)
2. [Nycklar](#nycklar)
3. [Nytt i 2.0](#nytt-i-20)
4. [Så fungerar det](#så-fungerar-det)
5. [GPU:n och kostnaden](#gpun-och-kostnaden)
6. [Klippen](#klippen)
7. [Verktyg](#verktyg)
8. [Drift på en server](#drift-på-en-server)
9. [Filer](#filer)
10. [Felsökning](#felsökning)

---

## Igång på tre kommandon

Kräver **Node ≥ 22**.

```bash
npm install
cp .env.example .env      # fyll i nycklarna (nästa avsnitt)
npm run share             # startar servern + en publik länk
```

Öppna `http://127.0.0.1:8600` (eller länken som skrivs ut), tryck **Sätt dig vid bordet** — då får sidan spela
ljud och Astrid hälsar — och skriv till henne. **Spelhändelser** spelar spelets repliker och utdelningar.

`npm start` kör bara servern (utan publik länk). Det fungerar också, men varje svar blir ~1 s långsammare
(se [Så fungerar det](#så-fungerar-det)). `npm run share` kräver `cloudflared` i `bin/` (Windows: `bin/cloudflared.exe`)
eller i PATH — https://github.com/cloudflare/cloudflared/releases.

**Första svaret efter vila tar ~3 minuter** — GPU:n startar då ("Astrid vaknar" syns). Sedan några sekunder per svar.

## Nycklar

Allt i `.env` i paketets rot. Nycklarna checkas **aldrig** in — de lämnas separat.

| Variabel | Var man får den | Vad den gör |
|---|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | svarstexten |
| `CARTESIA_API_KEY` | https://play.cartesia.ai → API Keys | rösten (Freja) |
| `RUNPOD_API_KEY` | RunPod, bolagets konto → Settings → API Keys | läppsynken (GPU) |
| `RUNPOD_ENDPOINT_ID` | `tdkbn6qxcyh4so` — endpointen `astrid-spel-lipsync` (avatar `astrid_spel2x`) | vilken GPU-endpoint |

Valfritt: `PORT` (8600), `CARTESIA_VOICE` (Freja), `GEMINI_MODEL`, `API_TOKEN` (skyddar POST /api/* när servern
ligger publikt), `SESSION_URL` (fast publik adress i stället för tunneln). Se `.env.example`.

## Nytt i 2.0

| | 1.0 | 2.0 |
|---|---|---|
| Bild | gammal 1440×1440-bild | **spelets startbild 1080×1920** — samma som deal- och idle-klippen |
| Röst | ElevenLabs, hela texten först | **Cartesia, rösten Freja** (engelska med svensk brytning), texten strömmas till rösten medan den skrivs |
| Munnen | rå MuseTalk: mörkare, suddigare läppar, ryckigt slut | **färgkorrektion + skärpning + mjukt slut** — samma kvalitet som de förproducerade klippen |
| Kodning | x264, brus i bordstexten | **NVENC** på GPU:n, bakgrund i produktionskvalitet, ~2× snabbare |
| Mellan svaren | stillbild | **idle-loop** (andas, tittar) — svar glider in sömlöst vid klippgräns |
| Spelhändelser | – | spelets 17 händelser med **3 repliker var** (slumpas) + 8 kortutdelningar |
| Kundens spel | – | **HTTP-API**: chat, speak, event, clips, health — se INTEGRATION.md |

## Så fungerar det

**Scenen.** Stillbilden ligger underst och två `<video>` växlar ovanpå. Alla klipp — idle, prat, utdelning —
börjar och slutar exakt i startbilden, så varje byte vid klippgräns är osynligt. När inget annat spelas går
idle-klippen i en viktad slumpföljd. Svar och spelhändelser köas och spelas vid nästa klippgräns; medan Astrid
tänker startas ingen ny idle, så svaret sällan behöver vänta.

**Rummet.** Alla som öppnar sidan sitter vid samma bord: samma chatt, samma klipp för alla. Svaren görs i en kö,
ett i taget. Svarstexten syns i chatten direkt (~1 s), klippet när läppsynken är klar.

**GPU:n (sessionsläget).** Med publik adress (`npm run share` eller `SESSION_URL`) beställer servern en *session*
av RunPod-endpointen: GPU-arbetaren ringer upp servern på `wss://<adress>/lipsync-worker` och håller en stående
anslutning — varje svar skickas direkt, ~2,5 s. Sessionen förnyas var ~6,5 min utan avbrott mitt i ett svar.
Utan publik adress går varje svar som ett eget RunPod-jobb (jobbvägen) — fungerar alltid, ~1 s långsammare.

**Personan** (`server/llm.mjs`): kort, varm, lite torr humor. Hon uppmanar aldrig till spel, ger inga spelråd
eller odds, nämner inget rums- eller casinonamn, och pekar på verktygen för ansvarsfullt spel om någon verkar
ledsen över förluster.

## GPU:n och kostnaden

RunPod Serverless med **0 aktiva arbetare** — betalning per sekund, bara när en GPU faktiskt kör.

| | |
|---|---|
| **Startar** | när någon öppnar sidan (förvärmning), skriver i chatten, anropar API:t eller spelar en spelhändelse |
| **Medan någon är aktiv** | en arbetare håller sessionen (debiteras hela tiden, även mellan frågor) |
| **Släcks** | **10 min efter senaste aktivitet** — även om flikar står öppna — plus 60 s tomgång |
| **Kostnad** | RTX 4090 ≈ $0,74/h. En timmes aktiv demo ≈ $0,75–0,85; tiominuterssvansen ≈ $0,13. Tomt = 0 |
| **Skydd** | dör servern hårt stängs sessionen själv inom 9 min, och nästa start avbryter kvarlämnade sessioner |

Inför en visning: sätt **Active workers = 1** på endpointen i RunPod-konsolen en stund innan, så slipper första
gästen kallstarten (~3 min). Sätt tillbaka till 0 efteråt.

## Klippen

Allt i `public/media/`, förteckning i `manifest.json` (också via `GET /api/clips`):

| Mapp | Innehåll |
|---|---|
| `startbild.png` | spelets startbild 1080×1920 — alla klipp börjar och slutar här |
| `idle/` | 5 idle-klipp à 3 s: still, breath, glance, cheek, insulted |
| `deal/` | 8 kortutdelningar: pos1–pos7 och posdealer; kortets position i `kortpositioner.json` |
| `repliker/` | **51 repliker**: 17 spelhändelser × 3 varianter (`<händelse>_<1–3>.mp4`), rösten Freja, texterna i `bank.json` |

Alla: H.264, BT.709, 24 fps, 1080×1920. Repliker och svar har ljud (−16 LUFS), idle och utdelning inget.
Byts klipp: `python verktyg/bygg-manifest.py`.

## Verktyg

| Kommando | Vad |
|---|---|
| `npm start` | servern på port 8600 |
| `npm run share` | servern + publik länk (sessionsläget) |
| `npm run prov:chatt` | röktest i en riktig webbläsare: idle, hälsning, en fråga, en spelhändelse, mobilvy → `prov-*.png` |
| `npm run kolla` | läser endpointens inställningar och säger vad som avviker |
| `npm run prova:serverless` | GPU:n direkt: kallstart → klipp → varmt klipp |
| `npm run terminera` | terminerar endpointens arbetare (efter ett nytt GPU-bygge) |
| `python verktyg/bygg-manifest.py` | bygger om `manifest.json` när klipp byts |
| `node tools/export-jakob-package.mjs --media public/media --out <dir> --schema <video.schema.json>` | offline-export av Dragge, Paow och Mårten i Jakobs leveransformat (se nedan) |

### Export till Jakobs leveransformat

`tools/export-jakob-package.mjs` läser `public/media` (bara läsning) och skriver per dealer `dealer/<id>/`: `deal_pos1..7`, `deal_posdealer`, `deal_hole`, `deal_flip` (standardtagningen, byte för byte), `VILA.png`, `REDO.png`, `idle/`, `repliker/<språk>/` (tyst MP4 med samma videoström + `.wav`), `klippinfo.json` (Emils fält plus ett `kevin`-objekt med allt Jakobs format saknar), `classification.json` (ett objekt per klipp enligt `lab/schemas/video.schema.json` på main) och `SHA256SUMS.txt`. Körvarianterna (`-i`, `-u`, `-iu`, `-v`, `-iv`) och repliker utan event (`greet_*`, `banter`, `remark_*`, `table_*`) ligger under `extra/`. Rummen hamnar i `bakgrund/`. Plats 1..7 = box 0..6. Verktyget kontrollerar varje fil med ffprobe (H.264, 1080×1920, konstant 24 fps, inget ljud, ingen rotation) och avslutar med fel om något avviker. Kör det utanför scout-hel1; demons kod och media rörs inte.

## Drift på en server

För att demot ska vara igång hela tiden, oberoende av en dator (Linux, Node ≥ 22, ingen sudo krävs):

```bash
HOST=anvandare@server bash drift/deploy.sh          # från din dator: kopierar paketet (+ .env första gången)
ssh anvandare@server 'cd ~/astrid-lipsync-demo-2 && bash drift/installera.sh'   # första gången
```

`installera.sh` lägger in användartjänsterna `astrid-demo2` (servern) och — om ingen `SESSION_URL` finns —
`astrid-share2` (Cloudflare-tunnel, länken i `public-url.txt`). Senare uppdateringar: bara `drift/deploy.sh`, som
startar om servern men lämnar tunneln i fred (annars byter länken namn). Fast adress: `drift/astrid.caddy` hos
serverns admin + `SESSION_URL=wss://<adressen>` i `.env`. Kör på port 8600, så det krockar inte med demo 1 (8500).

## Filer

```
server/server.mjs      http + rummet (WebSocket) + API + GPU-arbetarens uppringning
server/astrid.mjs      kön: fråga → text → röst → läppsynk → klipp
server/llm.mjs         Gemini, strömmad; persona och spärrar
server/cartesia.mjs    Cartesia över stående WebSocket (rösten Freja)
server/serverless.mjs  RunPod Serverless: sessionsläge, jobbväg, GPU:n följer aktivitet
server/share.mjs       Cloudflare-tunnel + publik adress till arbetaren
server/env.mjs         .env-läsning
public/                webbsidan (index.html, app.js, style.css) och media/
verktyg/               prov, endpointkoll, manifest
drift/                 tjänstefiler, deploy, installation, Caddy
answers/               genererade svar (senaste 60 sparas; skapas av servern)
```

GPU-arbetaren (MuseTalk, efterbehandlingen, NVENC) finns i repot `astrid-gpu-worker`.

## Felsökning

| Symptom | Orsak / åtgärd |
|---|---|
| "Astrid vaknar" i några minuter | kallstart (GPU:n vilade). Normalt ~3 min första gången. `npm run kolla` |
| Inget ljud | tryck "Sätt dig vid bordet" eller 🔈-knappen — webbläsare spelar inte ljud utan en gest |
| Svaren ~1 s långsammare än väntat | ingen publik adress → jobbvägen. Kör `npm run share` |
| `läppsynk: tidsgräns` | endpointen nere eller fel `RUNPOD_ENDPOINT_ID`/nyckel. `npm run prova:serverless` |
| Error 1033 på länken | tunneln tappade kanten — `npm run share` startar om den; se `tunnel.log` |
| Stäng demot | **Ctrl+C** i fönstret — då avslutas GPU-sessionen direkt i stället för efter upp till 9 min |
