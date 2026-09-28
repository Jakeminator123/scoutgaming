# Astrid demo V3

Ett delat blackjackbord där flera personer chattar med dealern **Astrid** samtidigt. Hon svarar med röst och
läppsynkad video som genereras i stunden, på spelets riktiga startbild, på **engelska, spanska, franska eller
kinesiska**. Mellan svaren lever hon (idle-klipp). Knappar låter henne dela ut kort till varje plats och spela
spelets förinspelade repliker, på alla fyra språken. Det här repot är exakt det som kör demot på Scouts server.
Kundens spel kan kopplas in via HTTP-API:t — se **[INTEGRATION.md](INTEGRATION.md)**.

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
3. [Nytt i V3](#nytt-i-v3)
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

Öppna `http://127.0.0.1:8600` (eller länken som skrivs ut). Man hamnar direkt vid bordet och Astrid lever i sin
idle-loop. Vid första tryckningen, var som helst, hälsar hon med röst: webbläsare tillåter inget ljud förrän
besökaren rört sidan. Välj språk med reglaget ovanför chattfältet och skriv till henne. **Dela ut kort** och
**Repliker** i sidopanelen spelar utdelningar och spelets repliker.

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

## Nytt i V3

| | 2.0 | V3 |
|---|---|---|
| Start | ruta "Sätt dig vid bordet" | direkt vid bordet; Astrid hälsar vid första tryckningen |
| Kortutdelning | klippet visar ett vitt kort | **ett ritat kort med valör och färg** läggs exakt över klippets kort när det ligger på plats (`public/kort.js`), och tonar bort efter en stund |
| Utdelningsknappar | i en lista | **tydlig panel**: dealern och plats 1–7 som på bordet, plus "Dela en runda" (plats 7 → 1, sist dealern) |
| Språk | engelska | **engelska, spanska, franska, kinesiska** — chattsvar och alla 51 repliker, rösten Freja lokaliserad till varje språk |
| Repliker | slutet kapat (de sista 8–11 rutorna saknades) | **alla omgjorda** med hela slutet: munnen stängs och tonar mjukt tillbaka till startbilden |
| Idle | 6 klipp | 4 klipp (blink och insulted borttagna — såg inte bra ut) |
| GPU-maskiner | ibland en maskin utan NVENC (14–17 s per svar) | servern **väljer bort långsamma maskiner** automatiskt (`server/serverless.mjs`) |

## Nytt i 2.0 (jämfört med 1.0)

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
| `idle/` | 4 idle-klipp à 3 s: still, breath, glance, cheek |
| `reactions/` | reaktioner som inte hör hemma i idle-loopen: `insulted.mp4` (kort förnärmad min, 3 s). Listas under `reaktioner` i `manifest.json`; demot spelar dem inte själv |
| `deal/` | 8 kortutdelningar: pos1–pos7 och posdealer; kortets position i `kortpositioner.json` |
| `repliker/` | **51 repliker**: 17 spelhändelser × 3 varianter (`<händelse>_<1–3>.mp4`), rösten Freja, texterna i `bank.json` |
| `repliker-es/` | samma 51 på **spanska** (`<händelse>_<1–3>_es.mp4`), Freja lokaliserad, texterna (+ engelskt original) i `bank.json` |
| `repliker-fr/` | samma 51 på **franska** (`…_fr.mp4`) |
| `repliker-zh/` | samma 51 på **kinesiska**, mandarin (`…_zh.mp4`) |

Alla: H.264, BT.709, 24 fps, 1080×1920. Repliker och svar har ljud (−16 LUFS), idle och utdelning inget.
Byts klipp: `python verktyg/bygg-manifest.py`. Klippen här är webbkodade (crf 20) för snabb laddning; originalen i
full kvalitet (crf 12) finns hos Emil.

## Språk

Astrid svarar på **engelska, spanska, franska eller kinesiska (mandarin)**.
- **Val av språk:** reglaget "Astrid svarar på" ovanför chattfältet. Varje besökare väljer själv, och valet sparas i
  webbläsaren.
- **Chattsvar:** svaret kommer på frågeställarens språk och hörs för alla vid bordet. Bubblan märks "Astrid · ES".
  - Rösten är Freja lokaliserad till språket, samma röst med infött uttal (`LANGS` i `server/cartesia.mjs`).
  - Prompten har en språkregel per språk (`LANG_RULES` i `server/llm.mjs`): svara alltid på valt språk, inga
    engelska ord, usted/vous/您. För kinesiska gäller dessutom en teckengräns och inga latinska namn.
- **Repliker:** knapparna spelar repliken på klickarens språk. Hälsningen kommer på besökarens språk.
- **API:** `lang` (`en`, `es`, `fr`, `zh`) följer med `POST /api/chat`, `/api/speak` och `/api/event`. Standard är
  engelska.

Rösterna (Freja lokaliserad): es `8f57cf2c-e650-4e10-a784-cd93d23ee7f4`, fr `a7d6a620-ee74-422b-bd31-61b0b1bf6718`,
zh `cef8def7-8d39-40bd-992b-71bf57bbed86`, engelska `bcdcad6d-4eb6-4a71-89fd-1ae2ce9f95d8`. Översättningarna är gjorda
för spelare i respektive land (Spanien, Frankrike, fastlandsmandarin), inte ord för ord; `bank.json` i varje
språkmapp har det engelska originalet bredvid.

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

## Drift på en server

För att demot ska vara igång hela tiden, oberoende av en dator (Linux, Node ≥ 22, ingen sudo krävs):

```bash
HOST=anvandare@server SSH_KEY=<nyckel> bash drift/deploy.sh      # från din dator: kopierar paketet (+ .env första gången)
ssh anvandare@server 'cd ~/astrid-utdelningsdemo && bash drift/installera.sh'   # första gången
```

`installera.sh` lägger in användartjänsterna `astrid-utdelning` (servern) och — om ingen `SESSION_URL` finns —
`astrid-utdelning-share` (Cloudflare-tunnel, länken i `public-url.txt`). Senare uppdateringar: bara `drift/deploy.sh`,
som startar om servern men lämnar tunneln i fred (annars byter länken namn). Fast adress: `drift/astrid.caddy` hos
serverns admin + `SESSION_URL=wss://<adressen>` i `.env`.

**Så kör det i dag** på Scouts server scout-hel1 (användaren `emil`): mappen `~/astrid-utdelningsdemo`, port **8700**
(`PORT=8700` i serverns `.env`; demo 1 har 8500), tjänsterna ovan som användartjänster med linger. Länken står i
`~/astrid-utdelningsdemo/public-url.txt` och byter namn om tunneltjänsten startas om (t.ex. vid omstart av servern).
`systemctl --user status astrid-utdelning astrid-utdelning-share`, `journalctl --user -u astrid-utdelning -f`.

## Filer

```
server/server.mjs      http + rummet (WebSocket) + API + GPU-arbetarens uppringning
server/astrid.mjs      kön: fråga → text → röst → läppsynk → klipp
server/llm.mjs         Gemini, strömmad; persona och spärrar
server/cartesia.mjs    Cartesia över stående WebSocket (rösten Freja)
server/serverless.mjs  RunPod Serverless: sessionsläge, jobbväg, GPU:n följer aktivitet
server/share.mjs       Cloudflare-tunnel + publik adress till arbetaren
server/env.mjs         .env-läsning
public/                webbsidan (index.html, app.js, kort.js, style.css) och media/
public/kort.js         det ritade kortet ovanpå utdelningsklippen
verktyg/               prov, endpointkoll, manifest, kortlägen (bygg-kortlage.py)
drift/                 tjänstefiler, deploy, installation, Caddy
answers/               genererade svar (senaste 60 sparas; skapas av servern)
```

GPU-arbetaren (MuseTalk, efterbehandlingen, NVENC) finns i repot `astrid-gpu-worker`.

## Felsökning

| Symptom | Orsak / åtgärd |
|---|---|
| "Astrid vaknar" i några minuter | kallstart (GPU:n vilade). Normalt ~3 min första gången. `npm run kolla` |
| Inget ljud | tryck någonstans på sidan (eller 🔈-knappen) — webbläsare spelar inte ljud förrän besökaren rört sidan |
| Svaren tar 14–17 s | GPU:n fick en RunPod-maskin utan NVENC (loggen: `arbetare utan NVENC`). Servern beställer då själv en till, högst 3 gånger per 10 min |
| Svaren ~1 s långsammare än väntat | ingen publik adress → jobbvägen. Kör `npm run share` |
| `läppsynk: tidsgräns` | endpointen nere eller fel `RUNPOD_ENDPOINT_ID`/nyckel. `npm run prova:serverless` |
| Error 1033 på länken | tunneln tappade kanten — `npm run share` startar om den; se `tunnel.log` |
| Stäng demot | **Ctrl+C** i fönstret — då avslutas GPU-sessionen direkt i stället för efter upp till 9 min |
