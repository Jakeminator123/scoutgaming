# Läppsynk: Kevins/Emils RunPod-upplägg, underlag för jämförelse

Svar på #312 6336913787. Detta är befintligt underlag. Inga nya GPU-jobb, ingen deploy och inga nycklar. Källkod enligt `kevin-staging` @ `de0d26ba`, i `kevin/croupier-scoutgg/server/`. Prod kör `kevin` @ `31f50618`, där samma filer gäller för de vägar som beskrivs.

## 1. Tre vägar i koden i dag

| Väg | Används till | Worker / image | Endpoint |
|---|---|---|---|
| **Rörlig** (`rorlig-lipsync.mjs`) | Färdiga dealrar (dragge, paow, astrid2): repliker, chattsvar och vinnarnamn talas *över* de rörliga klippen medan dealern ger kort | `ghcr.io/emacodehero/croupier-lipsync-worker` (källa github.com/EmaCodeHero/croupier-lipsync-worker, `worker/motor.py`). Serverless-tag `6c80fe50…`, staging-podd `fe1b55e9` | `mq7eiwanda72fg` "croupier-lipsync-staging", ADA_24/ADA_32_PRO, max 4, idle 180 s. Används i prod via `RORLIG=1`. Alternativt dedikerade poddar med samma image (`pod.py`), som ringer in med `&pod=<namn>` |
| **Serverless helklipp** (`serverless.mjs`) | Gamla Astrid-avataren (astrid_spel2x) och sidorepliker | `registry.gitlab.com/emacodehero/astrid-gpu-worker:d3a2d0a6` | `tdkbn6qxcyh4so` "astrid-spel-lipsync", ADA_24, max 2 |
| **Dealer-röst** (`dragge-voice.mjs`, `draggeSay`) | Reserv när ingen rörlig arbetare är varm: hela mp4-svar | astrid-gpu-worker `71f47174` / `6e8fff01` | `9hyt6a6e17223s` dragge, `7tcfouz8jib4wb` paow, `fxwf3rgwme748i` dragan (alla ADA_24, max 1) |

## 2. Kontrakt för den rörliga vägen, som är den som fungerat bäst

**Beställning (asynkron):** `POST https://api.runpod.ai/v2/<endpoint>/run` med body `{input:{op:'session', ws_url, ttl:3300, avatar:<dealer>}}`.
- Svaret `{id}` sparas i `orders`.
- `ws_url` = `wss://<publik origin>/lipsync-rorlig?token=<per-process slumpat 24 B hex>&avatar=<dealer>`.
- Arbetaren ringer tillbaka och stannar tills `bye` eller ttl.

**Behörighet:** endast den egna process-token eller podd-token (`RORLIG_POD_TOKEN`, annars härledd ur RunPod-nyckeln) godtas. Fel token ger close 4403.

**Handskakning:** den första meddelandet måste vara `pong` med `gpu`, `motor`, `forsta_bit_ms`, `rutor_per_s` och takes (`takes`/`idle`). Annat stänger sessionen.

**Per replik:**
- → `{t:'start', id, karta:[[tagning, förstaRuta, antal], …], ljud_url}`
- → `{t:'end', id}`
- ← `{t:'lapp', id, del, fran, till, rutor:[{tagning, ruta, rect}|null…]}` + rå H.264 (Annex B, 256×512) per 0,5 s
- ← `{t:'done', id}` eller `{t:'error', id, reason}`

Lapp k hör till kartans ruta k. Ljudet börjar `LJUD_FORE` = 0,22 s efter kartans första ruta.

**Koppling till ursprungsrutor:** kartan byggs av samma kedjegenerator som klienten (`public/idle-chain.js` `layChain`). Varje mun-lapp är taggad med tagning och ruta, och klienten ritar bara en lapp när exakt den rutan visas. Arbetaren har dealerns banker/kalibrering förbyggda i imagen eller `/data/avatars`, paketerade med Emils `paketera.py`. Tagningar som arbetaren inte annonserat blir vilorutor (`vilaMap`).

**Status:** `GET /lipsync-status` visar per dealer: ready, gpu, rutor/s, första bit, upptid och vila.

**Timeout och retry:** 15 s per replik. En timeout ger arbetaren 60 s vila. Vid `timeout`/`worker gone` köas jobbet en gång om till en annan arbetare, så länge repliken inte passerat sitt slut.

**Avbryt:** efter `inactivityMs` (8 min) utan aktivitet skickas `bye` och `POST …/cancel/<id>` för varje order. Förnyelse sker 150 s före ttl.

**Idempotens:** spelet väntar aldrig på läppsynken. Utan varm arbetare spelas inspelade steg utan lapp. En replik identifieras med talk-id.

**Beställningstakt:** en kallstart (image pull) kan ta minuter. Därför läggs en order i taget, och en ny tidigast efter 4 min utan arbetare (60 s vid forcerad förnyelse).

## 3. Senaste verifierade resultat (befintliga bevis)

**Prod-loggar 21/10 (`journalctl -u astrid-scout-demo`, scout-hel1):**
- Rörlig väg, paow och astrid2 på RTX 4090: första bit 365–596 ms per replik/svar, 51,6–58,2 rutor/s.
- Kallstart från beställning till uppkopplad: ~55 s (11:08:47→11:09:41 och 20:50:56→20:51:52).

**Serverless helklipp `tdkbn6`:**
- Arbetare med NVENC: 3,5–4 s per svar (uppmätt 25/9, kommentar i `serverless.mjs`).
- Arbetare utan NVENC (libx264): 14–17 s per svar.
- 21/10 hamnade de flesta sessionerna på arbetare utan NVENC. Endpointens räknare: 1348 klara och 333 misslyckade jobb.

**Kevins kvalitetsbeslut 20–21/10:** vår egen MuseTalk-worker underkändes ("helt värdelös"). Gällande väg är Emils image oförändrad, och staging körs på en RTX 4090-podd med den.

## 4. Kända svagheter att ta med i jämförelsen
- Kallstart ~55 s. Under tiden får chatten svar via reservvägen (väntar max 12 s, annars utan läppsynk).
- Serverless-maskiner utan NVENC ger CPU-kodning. Endpointens maskinval styrs inte av vår kod.
- En Caddy-reload på hosten bryter arbetarens websocket. Den ringer upp igen inom ~10 s, men repliken som pågår klipps.
