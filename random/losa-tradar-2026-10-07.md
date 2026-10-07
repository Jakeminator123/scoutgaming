# Lösa trådar mellan nivåerna

Datum: 7 oktober 2026.

Syftet är en lägesbild av vad som finns och vad som inte är ihopkopplat mellan nivå 1 (`/control`), nivå 2 (`/partner`) och nivå 3 (`/play`), plus lane-flödet och konton. Ingen tråd är åtgärdad här; koden är facit och deploy är inte kontrollerad.

| # | Funktion | Vad finns | Vad saknas | Var i koden | Nivå (1/2/3) | Koppling saknas? |
| --- | --- | --- | --- | --- | --- | --- |
| L1 | Lane-redigering med klipp och villkor för idle och kortutdelning | Nivå 1 sparar Astrids idle-vikter och användningssätt samt deal-frekvens per klipp, och administrationen kan lägga till, välja och ta bort lane-poster som delar Astrids bank. | Villkoren skrivs inte in i operatörspaketet, och en ny porträttlane får ingen egen klippuppsättning. | `lab/components/lab-studio.tsx:144`, `presentation-runtime/idle-policy.mjs:4`, `presentation-runtime/media-family-policy.mjs:65`, `lab/components/studio-administration.tsx:341`, `web/public/game-lanes.mjs:4` | 1 | ja |
| L2 | Export av lane-paket till bolag | Lagret kan skriva en ny revision med lane-id, spel, bord och branding, och partner-snapshoten läser senaste paketet som id-lista. | Ingen sida eller API-rutt anropar `publishPackage`, och spelmotorn läser inte `operator_packages`. | `web/storage/operator-store.mjs:350`, `lab/lib/partner-data.mjs:157`, `test/operator-store.mjs:175` | 1→2 | ja |
| L3 | Bolagets justering av bordsfärg och branding | Nivå 2 kan ändra filtfärg, marker och kort i den öppna vyn, och paketkolumnen kan lagra ett branding-objekt. | Valen stannar i minnet, snapshoten skickar inte branding till editorn, och inget publiceras till spelet. | `lab/components/kevin-bo/preview-runtime.mjs:70`, `lab/components/kevin-bo/kevin-backoffice.jsx:130`, `lab/components/kevin-bo/original-views.jsx:579`, `web/storage/operator-store.mjs:103` | 2 | ja |
| L4 | Probe | Editorn sparar policy och kan köra ett syntetiskt textprov, och spelmotorn har en decide-rutt som kan be om ett talpaket för Astrid. | Textprovet skapar varken ljud eller video, testvägen är spärrad i produktion, menyn Talgranskning pekar på Probe medan adminfliken med samma namn är en annan sak, och om Director saknar `/api/studio/probe` går det inte att se här: kontrollera i produktion. | `lab/components/probe-editor.tsx:28`, `lab/lib/probe-server.mjs:28`, `lab/components/lab-studio.tsx:142`, `lab/lib/scout-navigation.mjs:34`, `web/server.mjs:743`, `web/probe-runtime.mjs:62` | 1→3 | ja |
| L5 | Team-vyns serverkoppling | Verkligt läge visar medlemskap skrivskyddat, och förhandsvisningen kan lägga inbjudan och rollbyte bara i komponenten. | Inbjudan, rollbyte och suspend anropar inte servern; partner-API har bara login, logout och snapshot, och det finns ingen suspend-knapp. | `lab/components/kevin-bo/views/team.jsx:1`, `lab/components/kevin-bo/views/team.jsx:93`, `lab/lib/partner-session.mjs:261`, `web/partner-access-policy.mjs:13` | 2 | ja |
| L6 | Speech-QA 501 | Fliken Talgranskning visar registrerade repliker och manuell bedömning, och spelmotorn har en separat betald rutt. | Klienten kastar 501 på POST `speech-qa` innan något anrop, och admin-API:t har kontraktet men ingen registrerad gate eller handler. | `lab/components/studio-administration.tsx:125`, `lab/components/studio-administration.tsx:484`, `lab/lib/studio-access-policy.mjs:51`, `web/operator-speech-qa.mjs:9` | 1 | ja |
| L7 | `/api/history` och `/bo`-ompekningar på Render | Båda finns i spelmotorns server, historiksidan anropar POST `/api/history`, och Vercel-fronten har samma `/bo`-ompekning. | Enligt handoff är autodeploy av, så de här rutterna i `web/server.mjs` är inte deployade på Render. | `web/server.mjs:217`, `web/server.mjs:400`, `web/server.mjs:1018`, `apps/croupier-frontend/lib/player-area.mjs:136`, `apps/croupier-frontend/lib/server-ui.mjs:14`, `random/handoff-2026-10-07.md:31` | 3 | ja |
| L8 | Ljudklipp från nivå 2 | 39 mp3 ligger under `media/dealers/astrid` (bevaras). Nivå 1:s repliklista läser indexerade mp3 och förhandsfilm för fyra dealers när blob-index finns, och nivå 3 spelar dealerklipp via spelmotorns presentationsväg. | Nivå 2 monterar inte röstvyn, importerar inte repliklistan och når inga ljudfiler under `dealers/astrid`. | `lab/lib/studio-voice-lines.mjs:51`, `lab/components/kevin-bo/navigation.mjs:27`, `lab/components/kevin-bo/preview-runtime.mjs:69` | 1 och 3, inte 2 | nej |
| L9 | Skydd för sista administratören | Nivå 1 vägrar ta bort sista aktiva interna admin som har lösenord. | Nivå 2 har inget sådant skydd, och policytexten kräver det av anroparen utan att någon rutt räknar sista operatörsadmin. | `lab/lib/studio-admin-data.mjs:151`, `web/partner-access-policy.mjs:5`, `random/beslutsmatris-2026-10-07.md:26` | 1 och 2 | ja |
| L10 | Spelare, transaktioner och rapporter | Partnerportalens vyer finns, och den riktiga snapshoten lämnar listorna tomma med `notConnected`. | Ingen spelardata, transaktion eller rapport hämtas från spelmotorn. | `lab/lib/partner-data.mjs:6`, `lab/lib/partner-data.mjs:109`, `lab/components/kevin-bo/README.md:16` | 2→3 | ja |
| L11 | Skapa bolag, roller och medlemskap | Lagret kan skapa operatör, roll och medlemskap om en anropare skickar en giltig aktör. | Ingen HTTP-rutt eller sida anropar `createOperator`, `upsertRole` eller `upsertMembership`. | `web/storage/operator-store.mjs:285`, `web/storage/operator-store.mjs:300`, `web/storage/operator-store.mjs:319` | 1→2 | ja |
| L12 | Åtkomstjournal för operatörsskrivningar | `audit_events` tar dokument- och mediaåtgärder. | Operatörsskrivningar får inte plats i den spärren, och operatörslagret skriver ingen journalrad. | `ops/neon-studio/001-studio-metadata.sql:43`, `web/storage/operator-store.mjs:8` | 1→2 | ja |
| L13 | Spellobby och profil | `/play`, `/play/profil` och `/play/historik` finns och visar namn, saldo och valuta för inloggad spelare. | Lobbyn har ingen operatörskontext, och profiltexten säger att uppgifterna inte kan ändras där. | `apps/croupier-frontend/app/play/page.tsx:9`, `apps/croupier-frontend/lib/player-area.mjs:182` | 3 | ja |
| L14 | Inbjudan och återställning för operatörspersonal | Intern personal med rollen admin kan bjudas in, och återställning gäller roller som kontohjälpen känner igen. | Rollen `partner` ingår inte där, så inbjudan, återställning och lösenordssättning kan inte aktivera operatörspersonal. | `web/account-role.mjs:1`, `lab/lib/studio-admin-accounts.mjs:63`, `lab/lib/studio-native-auth-actions.mjs:32`, `lab/lib/studio-native-auth-actions.mjs:187`, `lab/lib/partner-session.mjs:192` | 1→2 | ja |
| L15 | Adminens val av riktigt bolag | Utan `partner_session` visar `/partner` en intern fixtur, och partner-inloggning kräver rollen `partner`. | En intern admin-cookie öppnar inte operatörsdata, och det finns inget val bland riktiga bolag. | `lab/components/kevin-bo/README.md:3`, `lab/lib/partner-session.mjs:190`, `web/storage/operator-store.mjs:263` | 1→2 | ja |
| L16 | Bakgrundszoner till spelet | Nivå 1 har zoneditor och en bakgrundsflik som länkar dit. | Klippytan säger att zonerna ännu inte styr spelets bakgrund. | `lab/components/lab-studio.tsx:143` | 1→3 | ja |
| L17 | Admin-kontrakt utan anropare | Kontraktet listar `clip-landing`, `clip-never`, `gen-landing`, `gen-verdict` samt GET `clips`, `generations` och `gen-verdicts`. | Ingen handler registreras för dem, och administrationsytan har inga formulär som anropar dem. | `lab/lib/studio-admin-contract.mjs:26`, `lab/lib/studio-admin-data.mjs:50` | 1 | nej |
| L18 | Fabrikens gamla API-anrop | Röstvyn i den oanvända fabrikskoden anropar `/api/bo/voiceline-review`, och övriga mutationer går via `runtime.api`. | Partner-ytan monterar inte den vyn, `runtime.api` kastar alltid, och motorn svarar 410 på pensionerade `/api/bo`-POST när studiopolicyn är på. | `lab/components/kevin-bo/original-views.jsx:3223`, `lab/components/kevin-bo/preview-runtime.mjs:69`, `web/server.mjs:649`, `lab/components/kevin-bo/navigation.mjs:34` | 2 | nej |

| L19 | Händelsers varianter för Vera, Amira och Mei | Händelser sparar varianter, villkor och videokopplingar för alla fyra dealers, och testbänken kör samma urval som spelet. | Spelets urval med varianter och villkor körs bara för Astrid; övriga dealers spelar originalmotorns fasta klippmappning från Dealers & klipp. | `web/presentation-api.mjs:106`, `web/clip-mapping.mjs:10`, `presentation-runtime/selection.mjs:56` | 1→3 | ja |

## Konton och roller, nuläge

Det här är en lägesbild. Inget av det ska tas bort.

Tabeller:

- `croupier_auth.users` med `role` (standard `reader`), plus `tokens`, `bo_auth_epochs`, `lab_sessions` och `api_keys`. Schemat ligger i `ops/neon-game/product-schema.sql:41`, inte i de numrerade Studio-filerna.
- Studio-migrationerna 001–005 ligger i `ops/neon-studio/`: metadata, taljournaler, speech-QA-tabeller, fullfile-reservationer, och i 005 `operators`, `operator_roles`, `operator_memberships`, `operator_packages`.
- `operator_memberships.user_id` är `croupier_auth.users.id` som text. Medlemsstatus är `active`, `suspended` eller `invited`.

Roller i koden:

- Kontofältet kan vara `admin`, `superadmin` (räknas som admin), `reader`, `staff`, `player` och `partner`.
- `web/account-role.mjs:1` gör admin/superadmin till admin och reader/staff/player till spelare. `partner` blir ingendera.
- Studio-ytan släpper bara in administratör (`lab/lib/studio-access-policy.mjs:9`).
- Operatörsroller är rader per bolag med en rättighetslista, inte de globala kontorollerna (`web/partner-access-policy.mjs:10`).

Inloggningar:

- Nivå 1: `/control/login`, session mot Studio. Lösenord sätts på `/control/set-password`.
- Nivå 2: `/partner/login` sätter cookien `partner_session` och kräver rollen `partner` (`lab/lib/partner-session.mjs:169`). Utan den cookien är `/partner` fixtur för intern admin.
- Nivå 3: `/player-login` och sedan `/play` och `/play/blackjack`. Profil och historik utan session går tillbaka till inloggning.

Flöden som finns:

- Bjud in intern admin: POST `users/invite`, bara rollen `admin`, mejl med engångslänk i 72 timmar (`lab/lib/studio-admin-accounts.mjs:60`).
- Skicka om länk: POST `users/resend`.
- Begär återställning: POST `reset-request` på auth-API:t, länk i två timmar (`lab/lib/studio-native-auth-actions.mjs:181`).
- Sätt lösenord: POST `set-password`, samma token-tabell.
- Byt och ta bort intern roll: POST `users/role` och `users/remove`, med spärr mot att ta bort sig själv och mot att ta bort sista interna admin.
- Operatörens team-vy skriver inget av detta. Det finns ingen partner-sida för lösenord.

## Dokumentation som lovar mer än koden

- `lab/docs/README.md:71` säger att Probe kan skapa ett nytt tal- och videopaket när spelaren är inaktiv. Textprovet i labbet är bara text (`lab/lib/probe-server.mjs:32`). Spelmotorns automatiska väg kan be om ett talpaket bara om taltjänsten finns (`web/probe-runtime.mjs:84`).
- `random/beslutsmatris-2026-10-07.md:26` säger att ingen kod finns för skydd av sista administratören. Nivå 1 har spärren i `lab/lib/studio-admin-data.mjs:155`. Det som saknas är nivå 2.

Omvänt ligger guiden efter koden:

- `lab/docs/README.md:7` säger att lobby, profil och historik återstår. Sidorna finns under `apps/croupier-frontend/app/play/`. Historikruttens Render-deploy är ändå öppen, enligt handoff.
- `lab/docs/README.md:21` säger att riktig partner-session är kvarstående arbete. `partner_session` finns. Kundavgränsad sparning av design saknas fortfarande.
- `lab/docs/README.md:111` säger att nivå 2 än så länge bara visar demonstrationer. Riktig inloggning kan visa det bolagets snapshot. Paket, spelare och design är ändå inte kopplade till spelet.

`docs/JOHN-HANDOFF.md` och `docs/LOCAL-PRESENTATION-RUNTIME.md:64` säger att lane-tilldelning till bolag och publicering till spel inte är byggda. Det stämmer med koden.
