# Koppla in Croupier-spelet

Demot är byggt så att det riktiga spelet kan använda samma delar. Två sätt, som går att kombinera:

1. **Klippen direkt** — spelet spelar de förproducerade klippen själv (idle, utdelning, repliker). Ingen server behövs.
2. **Servern som tjänst** — spelet anropar demots API när Astrid ska svara i chatten eller säga något nytt.

## Klippkonventionen (gäller allt)

- Alla klipp är **1080×1920, 24 fps, H.264, BT.709** och **börjar och slutar exakt i startbilden**
  (`/media/startbild.png`). Därför kan de spelas i valfri ordning utan övertoning: idle → deal → prat → idle …
- Visa startbilden som stillbild under/mellan klippen. Byt klipp vid klippgräns (när ett klipp är slut).
  Att klippa mitt i ett klipp ger ett synligt hopp.
- Två `<video>`-element som växlar (se `public/app.js`, `play()`) ger byten utan svart ruta.
- Repliker och svar har ljud; idle och utdelning har inget.
- Förteckningen över allt: `GET /api/clips` (samma som `public/media/manifest.json`):

```jsonc
{
  "startbild": "/media/startbild.png",
  "idle":     [{ "id": "still", "url": "/media/idle/still.mp4", "vikt": 40, "dur": 3.04 }, …],      // vikt = hur ofta
  "repliker": [{ "id": "blackjack_2", "event": "blackjack", "url": "/media/repliker/blackjack_2.mp4",
                 "text": "Blackjack, straight off the deal. Paid three to two.", "handelse": "spelaren får blackjack och vinner", "dur": 4.1 }, …],
  "handelser": { "blackjack": { "handelse": "spelaren får blackjack och vinner", "varianter": ["blackjack_1", "blackjack_2", "blackjack_3"] }, … },
  "deal":     [{ "id": "deal_pos3", "url": "/media/deal/pos3.mp4", "kort": { "cx": 396, "cy": 1105 }, "dur": 3.3 }, …],
  "kort_storlek": { "bredd": 63, "hojd": 85 }                                                       // px i 1080×1920
}
```

**Tre varianter per spelhändelse** (17 händelser × 3 = 51 klipp, rösten Freja). Händelsenamnen är desamma som i
spelets `bank.json`/`speech-lines.mjs` (`blackjack`, `dealerbust`, …); filerna heter `<händelse>_<1–3>.mp4`. Slumpa bland
varianterna och spela aldrig samma två gånger i rad — då låter det levande i stället för inspelat.

Utdelningsklippen slutar med ett **vitt kort** vid `kort.cx/cy` — spelets UI ritar valören ovanpå.

## API

Bas: där servern körs (lokalt `http://127.0.0.1:8600`, eller länken från `npm run share`). JSON in och ut,
Endast same-origin i webbläsaren. Alla POST utom det publika spel-API:t `/api/table` kräver
`Authorization: Bearer <token>`. Om `API_TOKEN` saknas är integrationsanrop blockerade.
Anropa från en betrodd server; lägg aldrig token i klientkod.

| Anrop | Vad | Svar |
|---|---|---|
| `GET /api/clips` | alla förproducerade klipp (se ovan) | manifestet |
| `GET /api/health` | läget | `{ ok: true, demo: true }` |
| `POST /api/chat` `{ who, text }` | Gemini väljer ett fast, granskat svar; röst och läppsynk genereras därefter | `{ text, url, dur, ms }` |
| `POST /api/speak` `{ text }` | Endast exakt text ur `RESPONSES` i `server/dealer-policy.mjs` godtas; fri text avvisas | `{ text, url, dur, ms }` |
| `POST /api/event` `{ id }` | spelar ett förproducerat klipp för alla i demots rum. En händelse (`blackjack`) ger en slumpad variant, aldrig samma två gånger i rad; ett exakt id (`blackjack_2`, `deal_pos3`) ger just det | `{ id, event, url, text, sound, dur, kort }` |

`url` pekar på servern (`/answers/…mp4`) — hämta den därifrån. Svaret kommer när klippet är klart:
**~3–6 s varmt, upp till ~2 min vid kallstart** (GPU:n startar när den behövs och släcks efter 10 min utan anrop).
Anropen köas — ett svar i taget. `503` = något i kedjan föll; visa då texten som undertext utan klipp.

```bash
curl -X POST http://127.0.0.1:8600/api/chat -H "Content-Type: application/json" \
     -H "Authorization: Bearer $API_TOKEN" \
     -d '{"who":"Emil","text":"What are the rules at this table?"}'
# {"text":"Blackjack pays three to two, and I stand on all seventeens.","url":"/answers/amufm4kr3.mp4","dur":5.1,
#  "ms":{"llm":900,"tts":600,"lipsync":4400,"total":5900}}
```

## Rummet (WebSocket)

Webbsidan pratar med servern över en WebSocket på `/`. Samma protokoll kan användas av spelets klient om
spelet vill ha demots delade chatt:

| Klient → server | |
|---|---|
| `{ "t": "name", "name": "Emil" }` | byt namn |
| `{ "t": "say", "text": "…" }` | chattmeddelande till Astrid |
| `{ "t": "event", "id": "blackjack" }` | avvisas; spelservern styr spelhändelser |

| Server → klient | |
|---|---|
| `hello { name, log, thinking, queued }` | vid anslutning |
| `said { who, text }` | någon skrev |
| `reply { id, to, text }` | Astrids svarstext (klippet kommer strax) |
| `answer { id, to, text, url, dur, ms }` | klippet är klart — spela `url` |
| `play { id, url, text, sound, dur, kort }` | spelhändelse — spela `url` |
| `thinking { on, queued }` · `status { text }` · `here { count }` · `error { text }` | lägesrader |

## Rekommenderad koppling i spelet

1. Spelets händelser (`voice.say('blackjack')` m.fl. i `web/public/app.mjs`) spelar en av klippen i
   `/media/repliker/<id>_<1–3>.mp4` direkt (slumpa, inte samma två gånger i rad) — de finns förproducerade med rätt
   röst, ingen server behövs.
2. Idle mellan händelserna: viktad slump över `idle` (se `pickIdle()` i `public/app.js`).
3. Chatten: spelets `/chat` anropar `POST /api/chat` (eller ersätts av den) och spelar `url` vid nästa klippgräns.
   Spelets `SPEECH_LINES`/`bank.json` och persona-spärrarna (inga spelråd, aldrig uppmana till spel) finns i
   `server/dealer-policy.mjs`; modellen väljer endast svars-ID.
4. `POST /api/speak` tillåter bara den fasta svarsbanken. Dynamiska spelrepliker kräver en separat granskad mallintegration.

## Drift

- **GPU:** RunPod Serverless-endpoint `astrid-spel-lipsync` (`tdkbn6qxcyh4so`) på Kevins konto, image från
  `astrid-gpu-worker` (GitLab CI). Samma avatar (`astrid_spel2x`) som klippen. Nytt bygge → peka templaten på nya
  sha-taggen och kör `npm run terminera`.
- **Server:** Node ≥ 22, en process, SQLite för demoidentiteter, plånböcker, spel, pauser och säkerhetslogg. Svarsklipp slutar serveras efter 24 timmar; högst 60 sparas när nya genereras.
- **Publik adress:** GPU-arbetaren ringer upp servern på `wss://<adress>/lipsync-worker` (sessionsläget). Med en
  fast adress (reverse proxy) sätts `SESSION_URL` i `.env`; annars skriver `npm run share` en tillfällig
  trycloudflare-adress. Utan publik adress fungerar allt ändå, ~1 s långsammare per svar.
