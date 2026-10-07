# Aktuell handoff — Scoutgaming

## Nuläge per funktion

| Funktion | Status | Avsnitt |
| --- | --- | --- |
| Nivå 1 /control | påbörjad — skal och sidmall; tre av sju gamla Studio-sidor utbrutna, fyra kvar | /control-ombyggnad |
| Nivå 2 /partner | påbörjad — session finns, speldata ej | Partnerportal |
| Nivå 3 /play | påbörjad — lobby/profil och historikrutt | Spelaryta |
| Studio-migrationer | klart — 001–005 applicerade på produktions-Neon 7 okt; CI-spärr före deploy | Partnerportal |
| Systemkarta | klart — tre nivåer, CI-spärr | Systemkarta |
| Render croupier-v2 | påbörjad — motor live, deploy väntar | Aktuell leverans |

Uppdaterad 7 oktober 2026. Detta är den enda löpande handoffen.
[Äldre komplett handoff, fryst på 4ed55a56](https://github.com/Jakeminator123/scoutgaming/blob/4ed55a5624a28cdd82d8a0c252ead7a24ef3165e/docs/JOHN-HANDOFF.md)
bevarar samtliga tidigare statusnotiser och kvittoplatser. Privata bevis,
journaler och backups ligger kvar; detta är dokumentstädning, inte nya order.

## /control-ombyggnad, 7 oktober 2026 kväll

Underlag: `random/control-inventering-2026-10-07.md` (varje knapp och flik, C1–C265),
`random/losa-tradar-2026-10-07.md` (19 ofärdiga kopplingar, inte åtgärdade) och
beslutsmatrisens rader 21–30.

Ändrat: delat tillstånd för Studio-sidorna ligger i `useStudioSession`
(`lab/components/studio-session.tsx`) med vakt mot osparade ändringar. Händelser →
klipp, Uppspelning och Guide & hjälp är egna sidor på sidmallen; val av dealer och
event följer med i adressen (`?dealer=&event=`), loggen i `sessionStorage`.
Dealers & klipp har tre flikar; Probe, Bakgrund och Uppspelning är länkar. Nio döda
Kevin-adresser ger 404. Sökattrappen och dubbla sparpiller är borta. Rotens startfiler
är borttagna; start sker med `node lab/start.mjs`.

Testat: 925 labbtester (921 gröna, 2 skippade webbläsartester, 2 omskrivna och gröna),
typecheck, build, systemkartan. Kvar i `studio.tsx`: Händelser, Klippbibliotek,
Talgranskning och Operatörschatt; de flyttas i nästa omgång och filen raderas sedan.

## Design, 7 oktober 2026

Johns designpaket (`Croupier-Studio-design`) är infört på nivå 1: sidomeny i fem
grupper (`lab/lib/scout-navigation.mjs`), nivåväxlare, lime/ink-tokens i
`lab/app/scout-theme.css`, ljust och mörkt läge (`theme-toggle.tsx`, sparas i
`localStorage` som `sg-theme`), och en gemensam sidmall (`page-template.tsx`) på
Dealers & klipp, Agentmodeller och Administration. Inloggningssidorna renderas
utan meny. Bakgrundszoner och Händelser ligger under Studio. Administrationen har
ett menyval tills sidan får flikar. Medlemskap i partnerportalen renderas från
`kevin-bo/views/team.jsx`; verkligt läge är läsbart, utkast finns bara i
förhandsvisningen. Testat: 919 labbtester gröna lokalt (två ffprobe-tester
kräver ffmpeg och körs i CI), typecheck, build. Kvar: filterchips i klipplistan,
dold `<select>` bakom dealerchipsen, sektionsankare i administrationen,
"Spara alla" som riktig batch. Beslutsunderlag: `random/beslutsmatris-2026-10-07.md`.
Jakobs regel 7 okt: repots logik är facit, John styr design, Kevins nivå 2
anpassas till repot och inte tvärtom.

## Konton, 7 oktober 2026

Agentkontot `LLM` (roll `admin`, `croupier_auth.users` id 5) skapades på Jakobs
begäran med samma villkor som hans dg97-konto, så att agenten kan granska `/control`
inloggad. Lösenordet är Jakobs, inte i Git. Nivå 1-inbjudningar till Kevin
(`kevin.negash@scoutgaminggroup.com`) och Emil (`emilmattsson@yahoo.se`) skickades
via `POST /studio/api/admin/users/invite` med `emailSent: true`. GitHub-inbjudningar
med skrivrätt: `EmaCodeHero`, Kevins och Johns e-post; grenarna `kevin`, `emil`,
`john` finns, och `main` kräver PR för alla utom repo-admin. Teamets inbox är
GitHub Issues med etiketten `inbox` (`inbox/README.md`, `tools/inbox.mjs`); de
första beslutsärendena är #2 till John och #3 till Kevin.

## Namn, 7 oktober 2026

Denna dokumentpassning samlar personalens gränssnitt under `/control`:
`/control/clips`, `/control/administration`, `/control/tree`, `/control/videos`,
`/control/openclaw`, `/control/activity`, `/control/guide`, `/control/zones`,
`/control/events`, `/control/probe` och `/control/operator-chat`.
Kevins importerade backoffice (`lab/components/kevin-bo`) ligger kvar på
`/partner` och `/partner/{operatorSlug}`. Det är inte kontrollpanelen.
`/studio` är labb-servicens basePath, inte en fjärde produkt och inte namnet i gränssnittet.
Spelarytan är `/play` och `/play/blackjack`.
`174f893` är pushad till `main`. Gamla `/bo`, `/bo/login.html` och `/bo/set-password.html` svarar 308 till `/control/administration`, `/control/login` och `/control/set-password`. `/api/bo` är kvar som inloggningsbrygga.
Inget öppet acceptanskrav nedan markeras klart av den här passningen.
Äldre meningar som kallar `/studio` för produktionsverktyget är 6-oktoberhistorik.

## Spelaryta, 7 oktober 2026

`/play` är Spellobby, `/play/profil` egen profil och `/play/historik` egen historik,
alla i `apps/croupier-frontend` ovanpå befintliga `GET /api/auth/session` och
`POST /api/player` via ingress-headers. Utan session går profil och historik till
`/player-login?returnTo=…`; lobbyn visar inloggningsknapp. Historiksidan anropar
`POST /api/history` för egna aggregerade resultat. `/api/v1/history` är
partner-API. Spelmotor och signerad direktstart är oförändrade.
Testat före resultatrutten: `apps/croupier-frontend/test/player-area.mjs` 6, `platform-ui` 13,
`game-entry` 12, `tsc --noEmit` grön. Kvar: operatörskontext i lobbyn
och redigerbar profil. Tomt resultat betyder inga avslutade rundor, inte en saknad rutt.

## Partnerportal, 7 oktober 2026

Nivå 2-skalet kan visa intern fixtur (`preview: true`) och riktig operatörsdata
(`preview: false`). Parallella filer i samma pass:
`ops/neon-studio/005-operators.sql`, `web/storage/operator-store.mjs`,
`lab/lib/partner-session.mjs`, `lab/lib/partner-data.mjs`,
`lab/app/partner/login` och `lab/app/api/partner`.

Gräns: `partner_session` är en egen cookie med eget syfte. En intern admin-cookie
öppnar inte partnerdata, och partner-cookien öppnar inte `/control`. Medlemskap
ger bara den egna operatörens data; annan operatör eller avstängt medlemskap ger
403, okänd slug 404. Spelare, transaktioner och rapporter är tomma med `notConnected`.
`/partner` utan session går till `/partner/login`. Interna admins ser fortfarande
fixturförhandsvisningen med Partnerportal-rubrik och login-länk.

Testat: `npm --prefix lab test` 909 pass (två ffprobe-tester kräver ffmpeg lokalt),
`npm --prefix lab run typecheck`, `test/operator-store.mjs`, `test/partner-access-policy.mjs`,
`test/studio-migrations.mjs`, `test/speech-ledger-import.mjs` 40 pass,
`docs/system-map/verify.mjs --check` 0 fel. Ingen riktig Postgres-körning här;
`tools/studio-isolated-qa.mjs` hashar nu `005-operators.sql` och körs i CI.

Drift: runtime kräver exakt migration 001–005. Kör `005-operators.sql` mot
produktions-Neon före deploy, annars svarar Studio-admin `unavailable`.
Kvar: operatörs-onboarding-UI, åtkomstjournal för operatörsskrivningar
(`audit_events` tar bara dokument/media), spelardata, transaktioner, rapporter.
Inget krav i T2–T4 är markerat klart.

## Systemkarta, 7 oktober 2026

Kartan beskriver nivå 1 `/control`, nivå 2 `/partner` och nivå 3 `/play`.
En Next-rutt som läggs till eller flyttas utan `routes.json` ger route-drift och CI-fel.
Kontraktens filhasher är prefixade. Inget acceptanskrav markeras klart.

## Aktuell leverans och ansvar

- GitHub: Jakeminator123/scoutgaming, main, repo-ID 1380630440. Gamla
  github-work-adressen vidarebefordras. Återskapa inte namnet.
- Ett Vercelprojekt: scoutgaming, prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD.
  Services bygger web från apps/croupier-frontend och studio från lab, båda fra1.
  Node-middleware och rotens request.path-regler för /control och /partner krävs.
- Render äger spelmotor/live/sessionauktoritet. Vercel visar UI och kör native
  Studio/admin-API; Neon håller policy/metadata/journaler, privat Blob medier.
- www.scoutgaming.tech är huvudadress. scoutgaming.tech och det gamla
  croupier-frontend.vercel.app ger 308. croupier-lab-ui.vercel.app behålls som
  kompatibilitetsalias. Det gamla frontendprojektet är en domänlös reserv med
  autobyggen och domäntilldelning av; det är inte markerat paused. QA består.
- Infrastrukturens tidigare verifierade leverans: 4ed55a56, Vercel
  dpl_3WvxoXqoraAj3WPBy2zG3pzhQipP READY, fullhook och CI37451320053 tre success.
  Läsande HTTP/static-prov och befintlig adminsession verifierade. Inga riktiga
  konto-/spel-/DB-skrivningar. Privat scoutgaming-delivery-final-read.json.

## Tre nivåer: denna ändring

Samordnat med chatten **Hämta Croupier från Kevins branch**, som släppt sina
filanspråk. /control är intern Kontrollpanel, /partner/{operatorSlug} är
Partnerportal och /play är Spelaryta med /play/blackjack. Fliken heter Administration.

Efter Jakobs förtydligande är nivå 1 en gemensam ScoutGamingGroup-adminyta:
/control visar verkliga verktygsingångar, inte Kevins parallella exempelpaneler.
Klipp/tal/media/konton-länkar leder till befintlig Studio med samma huvudmeny.
Oanslutna gamla exempelvyer visar en förklaring; de låtsas inte vara färdiga
produktionsverktyg. Kevin-komponenten renderas på /partner, inte /control.
Nivå 2 använder läsbara menyadresser och popstate. Gamla hashbokmärken fungerar.
Nivå 2:s lane-/designnotiser skiljer lokala marker/kort/bordsprov från faktisk
spelpublicering. Lokala designutkast kan fortfarande granskas i provbordet.
Operatörs-/administratörsbyte och authfel tömmer vyn; inga gamla utkast får
visas för en ny identitet. Klipp, masker, urvalsregler och publicering är interna.

/play/blackjack använder befintlig
sessionskontroll, sparad lane och spel-HTML. Äldre molnadresser går vidare;
giltig launch går genom samma signerade serverhantering och game-audience.
Spelmotor, media, sessionsformat och kunddatabas ändras inte.

Guide, ordlista och systembeskrivning förenar PDF-underlaget med aktuell kod.
Namn på ansvar är inte nya tjänster eller nya scheman. Privata random-förslag
ersätts med en pekare till aktiva dokument; originaltexter och PDF-kopior bevaras.
Den redundanta gamla agentbeställningen tas bort efter extern hashverifierad
backup i C:/Users/jakem/CroupierBackups/terminology-docs-20261006.

Lokalt verifierat: 43 riktade tester, båda typkontrollerna, båda produktionsbyggena
och full regression PASS. Isolerad webbläsare verifierar marker-notis, valt tema
i provbordet, bakåtknapp med bevarat utkast, operatörsbyte med bekräftelse,
omladdning med rätt lane, gamla hash-länkar och historik till annan operatör.
Den korta /administration går vidare till /studio/administration efter observerad
404 på den förstnämnda. Privat provkatalog: lab/data/platform-private/terminology-update.
Testservern och provfliken är stängda. Leverans a72c4bf1 är verifierad på
Vercel dpl_CMCcHtRDDDHxByk3VMRZw8ewtx2k, READY på exakt SHA, och
CI37462222613 har tre successjobb. Samordnaren verifierade 14 läsande
HTTP-prov, åtta JS/CSS-resurser och befintlig jakob-session: /control till
verklig Administration och klippverktyg, gamla #gen till förklaring samt
separat partnerförhandsvisning. Utloggade dokument går till login och
admin-/partner-API ger 401. Inga riktiga konto-/spel-/policy-/provider-skrivningar.
Privata kvitton: terminology-update/live-delivery.json och production-read.json.
Kompletteringen för en gemensam nivå 1 har dessutom 29 riktade tester,
ny Lab-typkontroll och nytt Lab-produktionsbygge PASS. Den behåller samma
färska adminauktorisering, lämnar partnerns data och utkast oförändrade och
skickar inga exempeloperatörsdata till den nya interna ingången.

## Nästa arbete och viktiga gränser

**Övertagande och stoppunkt, 6 oktober:** denna chatt tar över efter
**Hämta Croupier från Kevins branch**. Jakob skickar själv de två
personalinbjudningarna. Inga nya utskick/konton görs av agenten. Intern admin
når nivå 1, 2 och 3 med samma konto; nivå 2 var redan adminauktoriserad men
saknades i inbjudningstexten. Formulär, mejl och båda guiderna är nu samstämmiga.
`/partner` är en separat ingång med explicit val av demonstration, inte ett
automatiskt exempelbolag. Adminens val bland riktiga operatörer är
ännu inte aktiverat. Operatörens egen inloggning står i Partnerportal.
Riktiga kunder ska komma från verifierade organisationsanslutningar, inte namn
eller API-nycklar.
Gamla giltiga hashbokmärken och befintliga demo-adresser behålls.

Den avgränsade leveransen avslutar navigation/åtkomstinformation och
dokumentationsstädning. De öppna A–I-punkterna
är acceptans/driftarbete, inte ett påstående om att allt är produktionsklart.
Lokalt verifierat: 90 riktade UI-, serverrutt-, auth- och mejltester, Lab-
typkontroll och produktionsbygge PASS. Kod 4df5e74a och etikettkomplettering
ec060e73 är pushade; fullhook gav 1626 PASS/9 skip/0 fail vid båda kodcommits.
Vercel dpl_7vDDEzyvkN9ZLjqnyEhoKZHtF2Ny är READY på exakt ec060e73 med
produktionsalias, och CI37496945897 har tre successjobb. Sex läsande HTTP-prov
på första leveransen bekräftar login/401 utan inloggning. Befintlig adminsession
verifierade Kontrollpanel → nivå 2-ingång → Demo South → intern Administration.
Efter senaste publiceringen är även behörighetsvalets etikett verifierad live:
Administratör – nivå 1, 2 och 3. Det befintliga UI-provet bevakar denna etikett.
Privata loggar ligger under `lab/data/platform-private/level-two-takeover-*`.
Inga produktservrar har startats och agenten har inte skrivit konton, policy
eller riktig databas. Inga extra grenar, worktrees eller nya rapportfiler behövs.

Resend återlästes separat den 6 oktober: Johns verkliga inbjudan har **Bounced**
med **Recipient not found**, och mottagaradressen har lagts på suppression-listan.
Kontot väntar på aktivering. Rätt mottagaradress behöver bekräftas innan nytt
utskick; spärren har inte tagits bort. Ett mejl till Jakobs dg97-adress visas som
**Delivered** och det kontot som aktiverat. Det bevisar inte leverans till den
tidigare begärda Gmail-adressen, inte heller mottagarens faktiska inkorg eller
resetflöde. Exakta adresser och provider-ID finns endast i det privata kvittot
`level-two-takeover-delivery.json`. Jakob äger fortsatt utskicken och F:s
mottagaracceptans; denna agent har inte skickat något mejl.

**Personalinbjudningar, första leveransen 6 oktober:** samordnad fortsättning
efter a72c4bf1; åtkomsttexten har därefter kompletterats enligt övertagandet ovan.
Resend-adaptern skickar nu ScoutGamingGroup-mejl i text och HTML med
aktiveringsknapp, e-postadress och giltighetstid. Formuläret anger intern
adminpersonal, nivå 1, med åtkomst till hela nivå 1 och nivå 3 via samma konto
och lösenord. Befintlig serverauktorisering, kontokollisionskontroll,
transaktion och engångstoken används; spelarroller får ingen admintext eller
ny behörighet. Ingen lösenordsändring görs för mottagarna. Riktade mail-,
auth- och UI-tester samt Lab-typkontroll PASS. Kodleverans 6f32a58b är pushad;
full regression gav 1623 PASS, 9 skip och 0 fail. Vercel
dpl_B4kWYUVrsVa5aNmKGxiieQzoUu3s är READY på exakt kod-SHA med
www.scoutgaming.tech som produktionsalias. Befintlig adminsession har läst
den publicerade kontofliken/formuläret: tydlig nivå 1+3, endast adminval och
72-timmars aktivering. Inga konton eller tokens har skapats vid detta prov.
CI37462924847 är komplett med success i alla tre jobb.
De begärda verkliga utskicken
och mottagarnas aktivering/inkorg behöver eget leveransbevis enligt punkt F;
lokala testkonton bevisar inte mottagarnas aktivering.

Den enda arbetslistan är [CLOUD-MIGRATION](CLOUD-MIGRATION.md): T2–T4 för
verklig partneranslutning/lobby, A–I för övrig användar- och driftacceptans.
Pågående uppdrag är inte ett generellt mandat till nya migreringar eller betalda prov.

Resend är konfigurerat i produktion med domänbegränsad sändnyckel och
no-reply@scoutgaming.tech. Native invite/reset är Delivered till Resends
sandbox på 184fe66b; riktigt konto/token/aktivering/reset/inkorg återstår (F).
Den tomma extra Marketplace-installationen är borttagen, fungerande konto och
QA bevarade. Privat resend-setup-20261006.json. Äldre uppgift om tom nyckel är ersatt.

Regionprovet på samma 019dba6d flyttade Studio iad1→fra1: första
Studio→Administration 7,879→3,041 s, varm overview 1,595→0,328 s utan Neonuppgradering.
Färsk auth och anropsminskning består; första-/proxyväntan är inte fullförklarad (B).
Ingen generell latensgaranti. Båda Services använder nu fra1.

GG: senast läst workspace795524/source30689542, 12 TRIGGERED/5 IGNORED,
en incidentsida och 17 locationsidor; fil/rad partiell, sex öppna positionsluckor.
GitHub checks läses på fryst leverans-SHA; queued suite/inga runs bevisar
ingen incidentfrihet. Läs bara säker metadata via befintlig read-only-brygga,
inga secrets/annotationsmeddelanden, inga automatiska ignore/resolve.
Triagestatus och nästa krav finns i G; historiska fixtureklassningar är inte
nya bevis för incidenter utan positioner.

### Läsutredda drift- och backuprester — fortfarande öppna

Frame-varningen i `web/public/local-film-player.mjs:17` använder samma text
för saknad playing/presented/ended. Historiska goodluckprov är inte belägg
för ursprungligt idlefel. Behåll rVFC-spärren; nästa diagnos kräver terminal-
flaggor, readyState/currentTime/duration/visibility och exakt media-ID/SHA.
Zoner är editorlagring (lokala utkast+molnkoordinater+privataBlobklipp), inte
spelstyrning. Befintlig CAS/dimension/hash/Range/partialuploadkontroll saknar
full isolerad zonroundtrip/restartacceptans. Tidigare 88medieURLprov inkluderar
inte reference-poster. Startsideskoden byter SSRhero till annan layout och
asynkront intro; möjlig flimmermekanism kräver bildserie/layoutshift/laddnings-
tider inklusive mobile/reduced-motion före riktad fix.

Backupagenten återläste de uttryckligt angivna metadatafilerna utan bred
backup-/personarkivsökning. Extern produktbackupkvitto matchar dokumenterad
SHA256, 206filer/10mappar/125745905bytes och verifierade hash-/arkiv-/inventory-
flaggor. Gamebackupmanifest finns; tidigare32Postgrestabellers återläsning är
dokumentation, ingen ny DBkontroll. Privat OpenClawenhetsfil finns men är inte
fullbackup. Director `/data/catalog` och Gateway `/data/openclaw` saknar angivet
externt fullsnapshot/återläsningskvitto. Exportåtkomst har inte prövats. Kräv
faktiskt frysta/stoppade skrivare, fullsnapshot, externmanifest/hash och
SQLite integrity/FK/WAL enligt `ENVIRONMENT-RESTORATION.md:74`; maintenanceMode
eller quiesced-markör ensam bevisar inte writerdrain. Inga drift-/DB-/provider-
åtgärder, restore eller nya servertester gjordes i dessa läsutredningar.


## Acceptans som består

Isolerad SQL/HTTPS-fixtur är rättad och verkligt provad i CI; gamla FAIL sparas.
Game-persistence/concurrency är separat och saknar sitt isolerade prov.
Full P6, mänsklig läppsynk/kortkontakt, fysisk mic/kamera/mobil/Safari,
zonroundtrip, startsidesflimmer och externa Director/Gatewaybackups återstår.
Upload-problemet med kortflipp_kling_1080p.mp4 är öppet under H; ingen ny
produktmedia har aktiverats här. Se systembeskrivningen för aktuell arkitektur.

## Lanes och faktisk medierensning

Mobile Phone Lane är sparat förval. Versionerade lane-definitioner har ID/namn/
renderer/dealer/mediesamling i `gameLanes`/`gameLane`. Saknat/äldre `original`
migreras vid läsning till Mobile; HTML binds till serverns val och gamla queryparametrar
kan inte återaktivera Kevin. `web/public/card-presentation` ersätter `kevin-cards`;
kortgrund, källproveniens och kalibrering består.

Admin create/remove är revisionsstyrda. Aktiv lane kräver ersättare eller `null`
för sista lane; då stoppas ny Blackjack-start tills lane läggs till. Nya porträttlanes
delar Astrids bank/policy. Ny renderer/mediebank behöver adapter/verifierad media;
fria URL:er nekas. Lane-borttagning raderar inte delade medier.
Separat lane-publicering, nya dealers/spel och granskad svarskatalog är inte därmed byggda.

| Utförd åtgärd | Exakt omfattning / slutbevis |
| --- | --- |
| Lokal source/staging-rensning | 2 410 binära filer, 2 133 120 568 byte; faktiska hashar/säkra paths kontrollerade |
| Motsvarande Blob-rensning | 2 313 objekt, 2 131 771 483 byte efter `8f265831` LIVE/READY; komplett paginerad efterlista |
| Lokal deduplicering | 64 byteidentiska kopior, 14 216 404 byte; kvar 2 450 fysiska filer/764 115 959 byte |
| Blob-deduplicering | 58 objekt, 12 787 392 byte efter produkt `ebbbeb76`/QA `ee060804` och exakt medieläsarekvivalens |
| Slutlista Blob | 1 800 objekt/769 901 848 byte; just målen saknas, alla andra gamla paths/storlekar oförändrade |
| Bevarade publika adresser | 88 GET200/fullhash/storlek PASS: 44 produktion + 44 QA; dessutom 62 huvudobjekt HEAD/full SHA PASS |

Alla 2 514 logiska poster/ID/hashar/URL/åtkomstgränser består. Layout v1:s
`canonicalPath` pekar direkt på registrerad huvudkopia med samma hash/storlek/ändelse.
Mobile-media, zonreferens, kortbild, runtime/kod/kalibrering, uploadfiler, GPU-resultat,
speechreferenser, journaler och övriga objekt består. Produktion/QA delar Blob;
deras Studio-dokument/historik/mediarecords/speechreferenser och produktzoner
lästes före radering. Ingen ny visuell approval och ingen omskriven Git-historik.

Privata underlag i `lab/data/lane-media-audit/`:
`blob-purge-receipt.json`, `blob-after-purge.json`, `kept-readback.json`,
`dedup-cloud-purge-receipt.json`, `dedup-blob-after.json`,
`dedup-http-verification.json`, plan och lokalkvitto.
35 dedup-prov, hela fysiska bankens hashar och fyra dealer-sync `--probe` PASS.
Lane/CRUD/kort/policy/startprov och TypeScript PASS; äldre fullhook 1 418 PASS/9 skip.
Kontrollens privata cachekopior är hashkontrollerat borttagna; receipts består.

## Produktionsimport, avveckling och återställning

P7 är utförd på b0bc efter fryst export, oberoende admission och faktisk ALL0-drain.
Underhåll `dep-db16rv0u01pc73d442p0` var LIVE/childless: inga barn/skrivare/providers.
RunPod var tillfälligt Max 0/Active 0/FlashBoot OFF och alla sex workerfält/båda jobbfält 0.
Efter import återställdes Max 1/Active 0/FlashBoot ON före provideraktivering.
Gemensam Neon-policy är aktiv; produktens tre tal-/streamflaggor ON, kamera ON.
QA är kvar OFF. Aktiveringen är inte en generell kostnads-/mänsklig acceptans.

Studio 001–004, tre dokument, talhistorik, 18 aktiva och sex retained-mediaposter
är importerade. Sex original (8 262 169 byte) återfanns i `365f283b` och
fullhashades privat; liknande filnamn/familj får aldrig automappas till nya bytes.
Production/version1 fullfilspolicy adopterades via ett additivt INSERT;
numeriska tak/historik/reservationer ändrades inte.
Paritet PASS: 32 skyddade konto-/speltabeller, elva kostnadstabeller och exakta
dokument/media. Alla 17 alias återlästes med historiska mål/domäninställningar/SSO bevarade.
Den avslutade importen körs inte om; nya läskvitton får inte skriva om originaltider.

P8:s slutkod `9ba2fd05`/CI `37222438373` tre success verifierade diskfri drift.
Produktdisk DELETE204/GET404/`service.disk` saknas; tolv äldre Blobalias borta,
gamla-lista0/ersättningar12 och noll gamla Neon-dokument-/historikreferenser.
Explicit restart200: faktisk ny process, 160 rätta källhashar, åtta avvecklade
runtimefiler, AI3/Neon ON/health200 och ingen `/var/data`/persistent produktmount.
TLS `verify-full` bevarades; 51 övriga produkt-envvärden kontrollerades oförändrade.
Parent-env var direkt oläsbar efter UID-byte (EACCES); barnprocess/källa och
stabila deploy-/envavläsningar ger bindningen, inte en påstådd direkt parentläsning.

Privat `C:/Users/jakem/CroupierBackups/production-disk-retirement-20261004`:
206 filer/10 mappar/125 745 905 källbyte; full inventering, oförändrad källmetadata,
arkivläsbarhet och remote/lokal/arkivhash PASS. Behåll backupen efter avveckling.
Befintliga privata P8-journal/kvitton: diskfri `6cf5030f…`, data/HTTP `4615366b…`,
postdelete `bf582b0b…`; fulla pinnar finns i snapshotens importförlopp.

| Verifierat privat kvitto | SHA256 |
| --- | --- |
| P7 admission | `77eccc3a1ca99bca328f2abec8e11d4d37ec62b3797a2a7b25aea1c616b751c1` |
| Cloudplan | `25fe34d42251b1f57de6ff0ae7505459c0448c6d0ba500646aa7281a9115c59d` |
| BEFORE | `0555b7988d5f686d4b918a966bd82d1865a9a83d22c805a076e6f46df648ccb2` |
| Importplan | `94a458599f0c77ca8aaf468feccf4cc7d5e1e050f2f31662be8740796cde7442` |
| Avslutad import | `0f6907e41944f8c142381ffc2e02f218aeda53ea345dfcc38067a5245879b58d` |
| Full diskbackup | `12e99320409fab6b0dc9f3e475d06b4d9aa950d3f87d31cae0b3bf22530596b9` |

Återställning är en samordnad återgång, aldrig en andra writer eller automatisk fallback.
Frys alla skrivare, bevara senaste Neon/ledger separat och verifiera rätt scope,
schema/checksummor, aktuell paritet, media och rollbackpunkt före operation.
Gamla SQLite-/diskbytes får inte aktiveras efter nya Neon-skrivningar utan datatillbakaföring.
Gamebackup: `C:/Users/jakem/CroupierBackups/neon-game-20261002-132437`
(24 källtabeller/102 rader; 32 Postgrestabeller med rad-/sekvensparitet).
Labbbackup: `C:/Users/jakem/CroupierBackups/lab-consolidation-20261002`;
lokal syskonstädning: `C:/Users/jakem/CroupierBackups/local-project-cleanup-20261004T210828Z`
(214 bevarade filer, två verifierade Gitbundlar, workercommits kvar).
Återställningsprocedurer: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
QA-, Director-/Gatewaydiskar är aktiva/bevarade, inte P8-mål; extern Director/
Gatewaybackup är fortfarande separat kvarvarande ansvar.

## P6: delbevis, numeriska skydd och kvarvarande acceptans

### Verifierade delbevis — inte full P6

Historiskt native90/90 på `190399386d93a02882d9b18a5ce5af53bb91fe23`:
alla fyra dealers, två avkodade/hörbara/avslutade plays, samma sparade Neonrevision,
CAS/utkast/privata medier/native administration utan iframe. Projekt/pit återställda
med identiska hashar; browser/route-drain städade; inga mejl/betalda anrop.
Privat `lab/data/platform-private/native-cloud-browser-evidence/7bf33ee7-35a2-470c-a202-c00299af4443/receipt.json`,
SHA `dd67c29f73c24db234f4d079a5e5a241e43e39590eeefb95c2e40fa52faf4e20`.
Åtta layoutbildrutor godkänner inte läppsynk. Äldre FAIL-kvitton består.

På `e461ef073b63b2d1c937454bbfa31289774fcb8f`: 80/80 authkontroller över
68 HTTPS-anrop, 22/22 verkliga login-/städ-/källkontroller och 27 städgrupper PASS.
Admin når spel/Studio/BO, spelare nekas Studio, reader/staff-reset behåller game-only,
lösenord/epoch återkallar gamla sessioner, saldo/historik/paritet består.
Pending provider-cancellation är inte liveprovat av detta authprov.
Privat `p6-shared-auth-evidence/157ef3e2-d91a-4ab9-89b1-515460988c5e/` och
`p6-shared-auth-browser-evidence/1a6a69a9-a9b8-4a3c-94e7-79e67b9d182c/source-reattest.json`
under `lab/data/platform-private/`; egna fixtures borttagna.
Greeting-rehearsal på e461 har matching clip/återaktiverade tvåspelskontroller,
men saknar explicit ended-räknare/nya hashbevis/ny mänsklig approval:
`p6-browser-evidence-e461ef07/receipt.json`.

Faktisk isolerad SQL/HTTPS/restart: 41 grupper, fyra retained-guards och 46
oförändrade källhashar PASS. Täcker CAS/rollback/token/epoch/roller, signerad
actor/scope, walletnonce utan dubbelkreditering, journalimport och kostnads-/QA-rollback,
review exakt talpar/revision/roll, privat media, lokal mailpreview och kortsekretess.
Fixturer/processer städade, inga riktiga konton/molndatabaser/mejl/betalda jobb.

Fullfil `generated-bd1123e6caec51e8a232036547b0f8fc` fick Director/SDK-svar,
Cartesia-ljud och färdigt RunPod-paket. Två game-queue/audio-ended härledda plays;
per-play synliga frame-/ownerobservationer hann inte sparas och är okända.
Privat `verify-final-qa/fullfile-two-play-derived-attestation-8712e00b.json`.
cc77-run `75eaf797-9342-4e2c-8995-f3c759fade75`: 6 562 941 streambyte,
synlig bild, hörbart ljud, faktisk spelkö-END/completed SQL-request och browsercleanup.
Efter END avlästes provider HTTP200 CANCELLED, terminal/released/lease0/uncertain0/OFF.
Det är avslutad speluppspelning enligt Jakobs krav, inte ett naturligt provider-
COMPLETED-kvitto. Exakt tid för providertransition saknas; b0bc:s naturliga COMPLETED
är bara lokalt testat. Sammansatt snäv P7-admission återanvänder dessa delbevis och
oförändrade godkända e461-playbackbytes; full P6 och nya take-approvals förblir öppna.

QA:s äldre närvarogap består: `player_probe_sessions` 17→15 på a0 och 19→18
vid 42→37-övergången. Övriga 31 kontotabeller matchar; 24h TTL är möjlig orsak,
men tidigare radmetadata saknas. Original FALSE/compose=false skrivs inte om.
Senare aktuella 10/10-bevarandekvitton gör inte dessa äldre jämförelser full-PASS.

### Budget och framtida prov

Exakta Cartesia-/counting-priser är backlog enligt Jakob. Avgränsade funktionstester
kan använda dokumenterat okänd USD/null och mätt usage inom ursprunglig numerisk
budget/reservation/dispatchauktoritet. Detta är inget nollpris, verifierad faktura,
extra testfönster eller generell produktionskostnadsapproval.
Upprepa ingen prisinventering utan nytt konto-/tariffunderlag; extern Cartesia-
nyckelägare saknar tillgänglig egen kontoinloggning. Privat `p6-cost-evidence-20261004.json`.

Originalkampanj `f2c28b62-9ae7-4cd6-abcd-e2137f2206d6`, totaltak 10 USD inklusive
alla försök, budgetankare
`d1a8f8fedb96008369a9ec87091744718d03f2678a465a80d147101271f6c523`.
Historiskt reservation 5,251152/oreserverat 4,748848 USD; inget refund/reset.
Jakob höjde testtaket från två till sex genereringar totalt, inte per omstart.
Senaste closed39: usage 4 generationer/5 SDK/2 TTS/4 GPU, unresolved 0/refund 0/USD null,
head `8e7f3e2ee1a31e03291da5b59c40b7d695d4a40b156170e909853c5a1c9f03a6`.
Två av sex generationer var kvar; detta är inte ny färsk dispatchauktoritet.
Den gamla reservationspolicyn rymde inte ytterligare 1 USD inom oreserverat 4,748848.
Återläs faktisk journal före nytt prov; förbrukat/pending/uncertain är aldrig ”nytt”.

Fullfilsadmission kräver explicit belopp/policy före TTS/GPU; stream/fullfil delar
UTC-dygnssumma. Originalets 12 min/krav 8 min kvar, klientdeadline 300 s och separat
RunPod-TTL 180 s får inte förlängas tyst. Utgångna fönster återöppnas inte.
Successor är append-only med föregående journalhash; inga automatiska retries,
budgetrefunds eller nytt providerjobb vid reconnect. Gamla FAIL/manifest/tider bevaras.
SDK-import/prepare-only/router404/WS-binary/deterministisk baseline är inte acceptans.

Nytt liveprov kräver aktuell källa/Gitblobs, immutable basimage, färska worker/router/
entry-manifest, faktisk SDK 7.12.1/readback och separata Render/Web-child/SDK-envbindningar.
Exakt serverägd session/runda/sparad Neonpolicy, request/job/mediahashar och ägargates
måste avse samma körning. Tre cookieägda kontroller före connect/play/efter END;
en produktspelare/WS/video genom posegrind/talkö, presenterade frames/hörbart ljud
och två verkliga playback-ACK. `decoded-product-game-queue`, faktisk integration/
laddad källa och cleanup/cancel/terminal/drain krävs; inga ersättningswrappers.
Full P6 omfattar också text/bild/STT, fullfil/stream, SQL/HTTPS/restart, auth/revoke
och verklig invitation/reset där de återstår. `fullP6Passed` får inte sättas true tidigt.


## Funktionella regler som aldrig får komprimeras bort

Render äger kort/shoe/slump/wallet/rundor/resultat, sessionägarskap och cancellation.
Studio/Vercel sparar revisionsstyrd Neonpolicy, inte osparade utkast eller saldo.
En kandidat vid credentialresolver; collision/pending/fel lösenord ger generiskt
avslag utan fallback/klientroll. Admin får spel+Studio; superadmin är alias,
reader/staff är game-only. Playerlogin rensar gamla BO/Labcookies.
BO-audience/live roll/fingerprint/epoch och Origin/Host/JSON/CAS/audit består.
CRAIG-reset och native playerpasswordbyte behåller rätt identitet/saldo/historik;
Rendercancel kvitteras före OK. Självrollbyte/radering och sista-admin-race skyddas.
Engångstokens förbrukas atomiskt; hemliga partnerresultat är tillfälliga, inte listmetadata.

Alla fyra dealers delar spelaren. Tal är exakt text/audio/video/frame-index/
kalibrering/acceptans; ändrad audio-/videohash ogiltigförklarar visuell approval.
Ingen approximate-duration-match, gammal talvideo till ny text eller munoverlay.
Audit `pipeline/audit-dealer-sync.mjs --probe`, obligatoriska regressioner och
två rehearsalplays per dealer krävs för media/spelarändring, inte bara hashar.
Gamla BO-videopreviews är tysta historikklipp, inte lipsyncmaterial.
Observation följer faktisk spelflik utan andra playback; valt/laddat ≠ spelat.
Originalpolicy `legacyClipPolicy` och Astrid `mediaPolicy/idlePolicy` består;
gammal BO-tilldelning är read-only410 och import kräver explicit exakt match.
Privata chattar, secrets och signerade medielänkar hör inte hemma i publika logs/takes.
Neon/Blob-fel stänger med fel, aldrig diskfallback/fröprojekt/nollbudget.
Aktiva tools/test/fixtures/pipeline/web/media/kalibreringar/OpenClaw-state består.
Svarskatalog/automatiska spelararkiv är inte infört; kostnadsjournaler gallras inte.

GPU-shutdownrättningen börjar cleanup före gatewayväntan och signalerar båda barnen.
15 s naturligt provideravslut +15 s cancel +30 s journalmarginal, sedan högst 5 s HTTP
och 10 s lagring; barnets tvångsgräns 80 s/Render 90 s. Timeout lämnar återhämtningsbar
journal/reservation och felstatus, inte för tidigt släppt shared lease.
Isolerad Linuxkedja 4/4 och close 38/38 PASS, inklusive lease 0 före båda flushar/1 efter.
Zonbilden är registrerad privat PNG 1080×1920/1 628 428 byte,
SHA `eda87f9e877b00dbd2f02479db44ae5f41e2f182563825304906880ceee0088a`;
fel molnkälla ger 503 utan lokal fallback. Export 290×104 var pixelidentisk med befintlig zon.
OpenClawproxy tillåter endast avsedd toppnavigation till exakt /openclaw[/];
API/fetch/iframe/mutation/WS/Origin/Host/auth/pairing behåller separata kontroller.
Dessa prov ändrade ingen zonrevision, pairing, speldata eller betaldispatch.

## Historik (daterade lägesbilder)

Flyttade meningar som motsade nuläget 7 oktober 2026. De är inte raderade.
Kvitton, acceptans, P6, medieregler och privata sökvägar står kvar ovan.

### 7 oktober 2026 — Spelaryta-avsnittet, före resultatrutten i arbetskopian

Ersatt samma dag när historiksidan kopplades till `POST /api/history`. T4 är inte klar.

Historiken är ärligt tom: `readPlayerResults` saknar publik spelarrutt och `/api/v1/history` är partner-API. Ingen ändring i `web/`, spelmotor eller signerad direktstart. Kvar: resultatrutt för spelaren.

### 7 oktober 2026 — Namn-avsnittet, före Spelaryta och Partnerportal samma dag

Ersatt 7 oktober av Spelaryta- och Partnerportal-avsnitten.

Lobby, profil, historik, riktig operatörsinloggning och tenantdata är inte klara.

### 6 oktober 2026 — Tre nivåer: denna ändring

Ersatt 7 oktober av Namn-avsnittet (`/studio` är basePath, inte produktionsverktygets namn). Fliken heter fortfarande Administration.

Intern Studio på /studio är kvar som verkligt produktionsverktyg; fliken heter Administration.

Ersatt 7 oktober av Partnerportal-avsnittet (`partner_session` är en egen cookie; intern admin-cookie öppnar inte partnerdata).

Servern kontrollerar fortsatt intern admin på varje dokument/API-läsning.

Ersatt 7 oktober av Spelaryta-avsnittet (`/play` är Spellobby, med profil och historik).

/play är en enkel Blackjack-ingång.

Ersatt 7 oktober av Partnerportal- och Spelaryta-avsnitten.

Full partner-session/medlemskap/organisationslagring, publicerat operatörspaket,
kundavgränsad sparning samt spelarprofil/historik är fortfarande öppna T2–T4.
Den separata policyn web/partner-access-policy.mjs från cb2673c6 är fortsatt
bara policy; ingen runtime/DB använder den som verklig partnerinloggning.

### 6 oktober 2026 — Övertagande och stoppunkt

Ersatt 7 oktober av Partnerportal-avsnittet (medlemslagring och `partner_session` finns; lane-publicering och operatörsbunden lobby är kvar i T2–T4).

T2–T4 kvarstår för verkligt kundregister, kundpersonal, medlemskap, lane-publicering och operatörsbunden lobby.

Ersatt 7 oktober av en snävare mening i Övertagande: adminens val bland riktiga operatörer är kvar; operatörens inloggning står i Partnerportal.

Kundval är ännu inte aktiverat.
