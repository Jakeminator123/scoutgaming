# K01 medieinventering, AI Casino (2026-10-21)

All läsning skedde read-only på scout-hel1: staging-releasen `/opt/astrid-staging/releases/gh-238d6dd68174` (kevin-staging 238d6dd6) och 4090-workern kiud9j0a7fp5gn via ssh. Inget laddades upp, flyttades eller ändrades. Ingen GPU-körning gjordes.

"Används" betyder att sökvägen refereras i `public/*.js`, `public/studio/*.js` eller `server/*.mjs`. Det kontrollerades med grep, inte i körning.

## 1. Avatarpaket för läppsynk (4090, `/data/avatars`)

MuseTalk-paket som workern laddar (`AVATAR_DIR=/data/avatars`). Varje paket innehåller `pool.mp4`, `prep/` (`latents.pt`, `masks.npz`, `bias.npz`) och `takes.json`.

| Dealer | Storlek | Tagningar | Unika rutor (pool) | Vilo-rutor | Byggt |
|---|---|---|---|---|---|
| dragge | 121 MB | 77 | 1204 | 869 | 2026-10-20 23:15 |
| paow | 122 MB | 79 | 1345 | 986 | 2026-10-20 23:27 |
| astrid2 | 70 MB | 65 | 722 | 0 | 2026-10-20 20:49 |

Gemensamma värden: 24 fps, 1080x1920 och `vila_from` = `pos1-v`. Tagningarna mappar 1:1 mot dealerns idle-klipp i spelet (`takes` i workerns pong), och spelets väljare skickar idle-repliker bara till en worker som kan just den tagningen.

**Kan strykas:** `/data/avatars_gammal` (248 MB). Det är föregående paket från före bytet den 20 okt: dragge 64 tagningar, paow 63 och astrid2 65, identisk med nuvarande. Det sparas bara för rollback (`byt-paket.sh tillbaka`).

**Källklipp på podden** (används av paketeringen, inte i körning): `/data/media` (296 MB; astrid2 66, dragge 65, paow 64 klipp) är föregående omgång. `/data/media_ny` (215 MB; dragge 78, paow 80) är den aktuella omgången med de nya H3-idlarna (axlar, nick, blicksvep, lutfram). `banter_1.mp4` och `blackjack_1.mp4` i `/data` är provfiler och kan strykas.

## 2. Spelets media (staging `public/media`, totalt cirka 1,1 GB)

### Används (ska med till Blob)

| Sökväg | Storlek | Vad |
|---|---|---|
| `dealers/dragge/v2/` | 106 MB | dragges klipp och H3-idletagningar (77 mp4) plus `vila.png` |
| `dealers/paow/v2/` | 107 MB | paows klipp och H3-idletagningar (79 mp4) |
| `dealers/marten/v2/` | 81 MB | mårten (56) |
| `dealers/astrid2/v2/` | 95 MB | astrid2 (56) |
| `dealers/*/idle-v2/` | 5–14 MB per dealer | H3-idlar, 3,04–5,04 s (`h3IdlesFor`, `idleTakes` i server.mjs) |
| `dealers/dragge/repliker/{sv,en,pt,ko}` | 155 MB | förrenderade repliker, 81 per språk |
| `dealers/paow/repliker/{sv,en,pt,ko}` | 151 MB | samma |
| `dealers/marten/repliker/{sv,en,es,pt}` | 97 MB | samma |
| `dealers/astrid2/repliker/{en,pt,ko}` | 71 MB | samma |
| `dealers/rooms-v2/`, `dealers/rooms-wide/` | cirka 7 MB | rumsbilder (mobil och desktop) |
| `dealers/faces/` | 64 KB | ansikten i dealerväljaren |
| `cards/`, `table-styles/`, `manifest.json`, `silent.wav` | cirka 1,5 MB | bord, kort och manifest |
| `repliker/` (rot) | 28 MB | **används fortfarande av servern**: `shared-table.mjs:57` och `:81` bygger `/media/repliker/<event>_1.mp4` för alla dealers. Kan inte strykas utan kodändring. |

Studion har egna bilder i `public/studio/assets` (20 MB, rum och dealerutklipp), som också används.

### V1 eller oanvänt (kan strykas)

| Sökväg | Storlek | Varför |
|---|---|---|
| `media_omkodad_crf20_2026-09-25/` | 26 MB | omkodningskopia från 25 sep, ingen referens |
| `media/idle/` | 3,2 MB | v1-idle, ingen referens |
| `dealers/dragge/idle/` | 23 MB | dragges gamla idle före v2, ingen referens |
| `dealers/dragge/green/`, `green-startbild.png` | 46 MB | greenscreen-råmaterial, ingen referens |
| `dealers/dragge/room.png`, `startbild.png`, `timing.json` | 3,2 MB | ingen referens |
| `dealers/rooms/` (inte v2) | 7 MB | ersatt av `rooms-v2`, ingen referens |
| `deal/`, `repliker-es/`, `repliker-fr/`, `repliker-zh/`, `startbild.png` | cirka 51 MB | v1-Astrid ("Astrid (classic)"). Hon är pensionerad i studion (`RETIRED=['astrid']`, studio.js:15) men finns kvar i `dealers.js:67` och är reservvärde i `dealers.js:104`. Strykningen kräver att det reservvärdet byts till astrid2, annars landar okänd dealer på saknade klipp. |

Det som kan strykas är cirka 160 MB i spelet plus 248 MB i podpaket (`avatars_gammal`) och cirka 296 MB i källklipp (`/data/media`).

## 3. Att tänka på vid portningen

- Admin behöver styra **dealer → avatarpaket** (namn och byggtid ur `takes.json`) och **dealer → worker** om "allt styrbart från Admin" ska gälla. I dag är det hårdkodat i `public/dealers.js` (`clips`, `linesDir`, `lines`, `idles`) och i podmiljön (`AVATARS`).
- Idletagningarnas namn måste vara desamma i spelet (`v2/`, `idle-v2/`) och i paketets `takes.json`. Annars ger väljaren inte idle-repliker till workern.
- `?dealer=<id>` fungerar inte i dag: `/` 302:ar till `/studio/` utan frågesträng, och studion läser ingen sådan parameter. Den nya lobbyn bör få djuplänk per dealer.
- Mårten saknar avatarpaket på 4090:n, så han har förrenderade repliker men ingen läppsynk.
