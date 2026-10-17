# Scoutgaming: målbild, migrationsstatus och kvarvarande arbete

Uppdaterad 17 oktober 2026. Detta är den enda migrationsöversikten.
Aktuell arbetsbranch och nästa leverans finns i [handoffen](JOHN-HANDOFF.md).
Begrepp ägs av [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md), tekniska format av
[runtime-referensen](LOCAL-PRESENTATION-RUNTIME.md).

## Teknisk register-/runtimeflytt: avslutad i produktion

Neon som produktregister och Blob som mediekälla är implementerat, mergat
och driftsatt. Huvudagentens färska läsande avstämning 16 oktober bekräftar
produktion på `b38c56572158d6deaeb6823b3a66bf5fbca8af7e` enligt kvittot nedan.
Kodavstämningen fann inget konkret migrationsfel; produktionsvägarna är
oförändrade sedan denna baseline. Den tekniska flytten är därmed avslutad.
PR188 och PR190 är också mergade och verifierade på produktionens
`d7dd04dcbc1c3eab6358ac64b63ad7b5d97a9166` den 17 oktober.
Strukturfasen är avslutad; det daterade leveranskvittot finns i handoffen.
Kvarvarande produktfunktioner, historiska felobservationer och visuella
bedömningar redovisas nedan; de påstås inte vara färdigverifierade.

## Ytor och datalagring — produktion och nya QA

| Ansvar | Aktiv källa och tjänst |
| --- | --- |
| Intern personal, bolag, spelare | `/admin`, `/partner`, `/lobby` på www.scoutgaming.tech. Ett Vercel-projekt/team: `scoutgaming`. |
| Webb och Studio | `apps/web/` och `apps/studio/`; Vercels webb-/Studio-tjänster. `/studio` är teknisk basePath. |
| Spelmotor och live-transport | Render `croupier-v2`, källkod i `web/`; kort, shoe, saldo och avräkning är serverägda. |
| Produktregister | Neon: konton/spel, Studio-projekt, administration, scoped rum/publicering, mediekatalog och svarsbibliotekets metadata. |
| Mediebyte | Privat Blob; exakta identiteter, hashbindningar och behörigheter följer registret. |
| Director/Gateway | Aktiva OpenClaw-tjänster med egen konfiguration/sessioner på `/data/catalog` respektive `/data/openclaw`; inga alternativa produktregister. |
| Isolerade tester | Egna tillfälliga data/scope. QA/Preview-utbyggnad är pausad; ingen automatisk återstart eller produktionsfallback. |

Normal start `node apps/studio/start.mjs --no-open` skriver den publicerade lobbyns
adress. Endast explicit `--offline` skapar en isolerad, tillfällig fixture.
Lokala arbetsfiler, katalogexporter och SQLite-backuper är authoring/historik,
inte produktens runtimefallback. `apps/studio/lib` innehåller aktiva delade tjänster.
Äldre Control-komponenter och sparade ID:n behålls där konsumenter finns.
Dragan är ordinarie dealer; Astrid är märkt legacyreferens utan trelagersversion.

## Levererat och verifierat

| Leverans | Exakt bevis |
| --- | --- |
| Admin-konsolidering, scenzoom, filmvisare, Astrids märkning | [PR185](https://github.com/Jakeminator123/scoutgaming/pull/185), main `3165ab6df94c965aa3db1f986b8532a0f9260073`; föregick registeromkopplingen. |
| Schema 012 och import | Befintliga Neon `production/croupier`, databas `croupier_game`, projekt `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`. Separat återläsning 16 oktober 18:38 UTC. |
| Schema 013 för rörligt tal | Additiv migration tillämpad och återläst 17 oktober 12:46 UTC i samma speldatabas och scope. Binder antagna talsessioner till exakta mediereferenser. Verifierar schemat, inte GPU-drift eller synlig läppsynk. |
| Runtime kräver 012, läser katalog/replikmetadata från Neon och byte från Blob | [PR186](https://github.com/Jakeminator123/scoutgaming/pull/186), main `2ea080bc3e75cf0207e3c155f9b4018f6a8d301e`. [PR-CI 38953385914](https://github.com/Jakeminator123/scoutgaming/actions/runs/38953385914) och [main-CI 38954442660](https://github.com/Jakeminator123/scoutgaming/actions/runs/38954442660) gröna, inklusive isolerad riktig PostgreSQL, omstart, HTTPS och migrationsberedskap. |
| Samlad slutredovisning | [PR187](https://github.com/Jakeminator123/scoutgaming/pull/187), migrationsbaseline `b38c56572158d6deaeb6823b3a66bf5fbca8af7e`. |

012:s SQL-kontrollsumma:
`5618ae06bcae43c77778f2d7bc777e86d2fabafa2f26c5f139d90d06dc72d291`.
Katalogrevision:
`9201007d27c7b6464cbd905123c59b48608083a1af726ee9f896767e6e7bff20`.

Importkvittot omfattar 760 layoutposter, 542 Blob-referenser, 51 bankklipp,
18 exakta JSON-manifest och 12 historiska replikposter. Alla 514 unika
katalogobjekt strömlästes mot SHA-256, storlek och medietyp. De 79 befintliga
medieposterna samt project/administration/social-policy var hashoförändrade.
Inga filmer regenererades eller mediebyte flyttades.

### Färskt läsande produktionskvitto — 16 oktober 2026

Huvudagentens nya kontroll: Vercel `dpl_FuDAT4aRmniTWGbvgEPXpa874rip` READY
och Render `dep-db97r50ae00c739b10d0` live på samma fullständiga `b38c5657`-SHA
ovan. Render health/version gav 200. Neon-identiteterna i tabellen stämmer;
ledgern är 001–008, 011, 012 och 012:s kontrollsumma matchar LF-normaliserad
källa. Katalogrevisionen ovan är oförändrad: 760 layoutposter, 542 Blobrefs,
51 presentationposter och 12 talposter.

Två nya GET-/hashstickprov via `www.scoutgaming.tech/media/` matchar Neon exakt:

- `dealers/astrid/runtime/assets/lab/astrid-pilot.mp4`: 200, 667 364 byte,
  SHA-256 `61d7d1c57b1cf720113bfa12dc8ad63175f5000fb6c2b29685229aa450523ed5`.
- `dealers/astrid/runtime/composited/astrid-blue-box4/mask-manifest.json`:
  200, 626 byte, SHA-256 `bf5122706cc1ff3228565a1e42b61b96ed9bda3ee196a8ee24dd53401019d3aa`.

De 514 fulla Blob-återläsningarna tillhör det äldre PR186-importkvittot,
inte den nya stickprovskörningen. Ingen ny skrivning eller visuell
läppsynk-/spelbedömning ingår i den färska kontrollen.

### Föregående PR186-kvitto

16 oktober 19:32 UTC: Vercel `dpl_9k1cogPcn5zh6wxZJxoN97iXtoYV` READY,
Render `dep-db97ls49v7es73f419v0` live på `2ea080bc`. Engine version
bekräftade full SHA och health gav 200. Publikt manifest (626 byte) och
`astrid-pilot.mp4` (667 364 byte) gav 200 med exakt kataloghash;
direkt Render-media gav förväntad ingressspärr 421. Detta var läsande
driftverifiering utan nya produktionsdata, inte läppsynk- eller spelprov.

## Verkliga migrationsfel och kvarvarande utredningsspår

Inget konkret aktuellt migrationsfel identifierades i den färska kod-/
driftavstämningen. Ingen äldre öppen checkbox är ensam bevis på ett sådant fel.
Nytt reproducerat fel i auth, bolags-/rumsgränser, publicering, schema eller
beständig lagring ska behandlas som fel i den berörda kedjan, inte döljas
som kosmetik. De äldre observationerna här har inte omverifierats i detta pass:

- Blandade frysta 16/17-eventpaket har gett publiceringskonflikt 409.
  En tidigare kompatibilitetsrättning levererades; återstående fall kräver
  exakt paket/revision och isolerat omprov, inte omskrivning av historik.
- `studio_request_rejected` vid automatisk korsdomänsnavigering och
  auth/session-GET på 1,3–6,45 s är äldre observationer. Manuella returer och
  senare Admin-login/navigation har egna kvitton; full roll-/destinationsmatris
  är inte därmed nyverifierad. Behåll skydden och reproducera konkret fel.
- Äldre uppladdning `kortflipp_kling_1080p.mp4` kunde inte väljas som
  idle-variant. Kontrollera listning → val → sparning → återläsning med
  isolerade data om felet återkommer; inget aktuellt rotorsaksbevis finns.
- Historisk ”Film ended without a presented frame”, zoners
  spar-/omstartsflöde och startsidesflimmer saknar full rotorsaksutredning.
  Detta är separata funktionsspår, inte belagda fel i Neon-omkopplingen.

## Separat produktarbete och öppna driftansvar

| Område | Kvarstående konkret ansvar |
| --- | --- |
| N2/operatörsdata | Spelare, transaktioner och rapporter från motorns auktoritativa ledger; bolagsbunden nyckel-/spelaridentitet, valuta/precision, idempotens och exportisolering. Ingen andra skrivbar plånbok i Studio. |
| Adminlogg och spelarflöde | Global ändringslogg saknar anslutet API. `/lobby` saknar fortfarande `/play`-vyns bordval enligt baselinen; båda är öppna produktluckor och har inte omverifierats eller åtgärdats i detta pass. |
| Konto och integration | Partnerreset, riktig 2FA, scoped API-nycklar/rotation, wallet-/webhookprov och säker onboarding/brandimport. Livebord, dealer-/limitbyten, schemaläggning, spelaransvar och rapport/statistik/revshare hör till senare produktleveranser. Marker/chips (L4) är inte klara. |
| Riktig invite/reset | Resendtransport till sandbox är verifierad; verklig mottagaraktivering, inkorg och resetkedja saknar komplett kvitto. John-adressen studsade och var spärrad hos provider; bekräfta adress och providerstatus före nytt utskick. Jakob äger de tidigare verkliga utskicken. |
| OpenClaw/Adminrobot | N1-engångslänk, ny profil, negativa roller, session efter sajtutloggning och driftsatt modellkonfiguration kräver avgränsade funktionsprov. Fem roller bevisar inte fem servrar eller inaktiv trafik. Mät före pensionering. |
| Nytt tal/läppsynk | Rörligt kroppsunderlag, providertransport, återgång/städning och faktisk synk är produktarbete. `lipsync-test` visar 139 incheckade filmer och är inte en färdig Neon/Blob-/talproduktkedja. Betalda jobb kräver eget mandat. |
| Radering och äldre mediereferenser | B18: permanent klippradering med beroendespärr/journal; B19: nya talklipp från grundbild. De planerade 009/010-numren är historiska förslag, inte tillstånd att ändra dagens ledger. Gamla bankindexreferenser, saknade `speech-media`-filer och äldre `runtime/hands`-byggare behöver separat konsument-/källbedömning. |
| Plattform | A22b/`packages/platform` väntar på Jakobs beslut i [ärende #52](https://github.com/Jakeminator123/scoutgaming/issues/52). Ingen katalogflytt eller full frikoppling är beställd genom detta statuspass. |
| Backup och QA | Extern fullbackup/återläsning av Director/Gateway återstår. QA:s tidigare probeparitetsluckor (17→15, 19→18) och EACCES-åtkomstgräns är historiska, inte förklarade av antagen TTL. Ursprunglig Preview-ingresshemlighet är inte återställd. Se återställningsguiden. |

PAOW-historikens 12 replikposter har 24 sedan tidigare saknade Blob-filer.
De återaktiverar ingen dealer. Blob/Neon-inventeringen fann även 30 registrerade
klipp utan explicit aktuell prodreferens och 602 objekt utan referens i lästa
källor; detta bevisar inte raderingsbarhet. Metod och gränser finns i
[lagringsavstämningen](storage/BLOB-NEON.md) och
[inventeringen](storage/BLOB-NEON-INVENTERING-2026-10-16.md).

## Admin checkpoints C1C9

Detta är en kort kontinuitetslista, inte nio nya manuella godkännandegrindar.

| Del | Bevarat kontrakt och återstående avgränsning |
| --- | --- |
| C1–C3 | Ansvar, navigation och sammanhållen N1-layout är levererade i flera steg. Nya layoutfel testas där de uppstår; äldre kvitton friskförklarar inte varje vy. |
| C4 | Dealer, bolag, verkligt rum, spel och sammansättning följer meny/direktlänk/loginretur/historik. Full roll-/destinationsmatris är inte omverifierad här. |
| C5 | Spara/återläsa, 409-konflikt, historik och verkliga osparade ändringar har riktad täckning. Ett valt rum gör inte en gemensam mallskrivning rumsspecifik. |
| C6 | Behörighet, scoped `roomOverrides`, granskad revision och N1→N2→N3-publicering har isolerade prov. Baselinekvittots noll aktiva bolag/rum/sammansättningar var avsiktligt; antalet är inte omverifierat här och gamla raderade demorumsprov är historik. |
| C7 | Riktad verifiering av ändrade spel-/mediebeteenden; generellt krav på två spel eller manuell spelacceptans är ersatt. Ingen ny visuell synkbedömning påstås. |
| C8–C9 | Konsumentstyrd städning, kanoniska guider, liten PR, ägarskapskontroll och obligatorisk CI. Aktiva Control-komponenter/`apps/studio/lib` är inte förbrukade bara genom sina namn. |

## Verifiering, leverans och återställning

Jakob har ersatt det generella tvåspelskravet och manuell spelacceptans som
grind för commit, PR, merge eller avslutad uppgift. Välj riktade prov efter
ändringen och konkret risk. Upprepad uppspelning testas när återstart,
städning eller flera uppspelningar är det ändrade beteendet. Auth, rumsgränser,
revision, sparande, pengar och spelregler behåller relevant täckning; full CI
är kvar. Äldre P6-/fyradealerskrav är inte automatiska migrationshinder.
Visuell läppsynk får fortfarande inte påstås från hash eller gröna tester.

Obligatoriskt nytt schema ska finnas före merge. Undantaget
`deploymentOptional` kräver först tolerant kod, sedan uttryckligt auktoriserad
migration och därefter en PR som gör versionen obligatorisk. Ändra aldrig
checksumfrysta scheman/ledger för att få grön CI.

GitGuardian: huvudagentens läsning 16 oktober gav aktiv övervakning,
0 öppna/18 ignorerade; platsmetadata och historisk skanning är ofullständiga.
Grön produkt-CI bevisar inte full säkerhetstäckning. Inga incidenter ändras här.

[ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md) är proceduren för
backuper och rollback; [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md)
äger konfiguration, profiler och nyckelansvar. Bevara senaste Neon/ledger och
frys skrivare före återgång. Historisk diskbackup är aldrig automatisk fallback
eller en andra writer. Privata original, env och importkvitton stannar utanför Git.

## Exakt historik i stället för upprepade kvitton

- [Migrationsbaseline: CLOUD på b38c5657](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/CLOUD-MIGRATION.md).
- [Migrationsbaseline: handoff på b38c5657](https://github.com/Jakeminator123/scoutgaming/blob/b38c56572158d6deaeb6823b3a66bf5fbca8af7e/docs/JOHN-HANDOFF.md).
- [Levererat strukturpass på f066ba4d](https://github.com/Jakeminator123/scoutgaming/blob/f066ba4d713f5af0191b7ba09f4b299755ad55c3/docs/JOHN-HANDOFF.md), [PR190](https://github.com/Jakeminator123/scoutgaming/pull/190).
- Separat [PR188](https://github.com/Jakeminator123/scoutgaming/pull/188), head `1eb42c3e`: frivillig kartrapportering hålls skild från produktprov; [full CI 38961755164](https://github.com/Jakeminator123/scoutgaming/actions/runs/38961755164) grön. Ingen merge ingår här.
