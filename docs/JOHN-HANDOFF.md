# Aktuell handoff — Scoutgaming

Uppdaterad 18 oktober 2026. Den beslutade strukturflytten är levererad och
verifierad, inklusive rättningen av lokal klippmappning. Inga fler rotflyttar
återstår i strukturplanen. Tal/läppsynk och övriga öppna produktfunktioner är
separata arbeten; hela casinoprodukten är inte slutverifierad.

## Strukturens slutkvitto

Accepterad strukturrevision är **`2ba5bf03437b8f7da8a60d06335831abaf50f162`**,
[PR237](https://github.com/Jakeminator123/scoutgaming/pull/237), ovanpå
[PR236](https://github.com/Jakeminator123/scoutgaming/pull/236). Slutlig
mappkarta och ansvar finns i [README](../README.md#source-and-folder-map).
Neon är produktregister och Blob mediekälla. Källkodens nya rötter ändrar
inte sparade medieidentiteter, publika URL:er eller privata datarötter.

| Kontroll | Verifierat resultat |
| --- | --- |
| CI | [PR-CI 39112069295](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112069295) och [main-CI 39112728886](https://github.com/Jakeminator123/scoutgaming/actions/runs/39112728886) SUCCESS på slutliga revisioner. |
| Lokal klippmappning | Nytt prov av verklig isolerad HTTP-server reproducerade felet före rättning. Efteråt återfinns 17 talposter, 2 native-talposter och 2 filmade tagningar; token saknas ger 401 och autentiserat cloudRuntime ger 404. Ingår i CI. |
| Databas | Isolerad PostgreSQL/omstart/HTTPS i CI; produktionsledger ready med pending=[] kl. 08:53:56 UTC. Required schema 014 är installerat. |
| Frontend | Vercel `dpl_JBah2ng3jCQtKDpk25P4f7MVpqrW` READY på accepterad SHA; 17/17 produktionskontroller. |
| Spelserver | Render `dep-dba8id8ae00c739g70fg` LIVE 08:56:42 UTC på accepterad SHA. Version, health/lobby 200, privata gränser 401, Admin-retur 307 och oautentiserad klippmappning 401 med Bearer/no-store verifierades 08:57:42–43 UTC. |
| Gateway/Director | Gateway på `d55ce412714e9e0c85103358f381098ce3d35077`, normal deploy `dep-dba28hnavr4c73fsf3fg` LIVE 01:45:00 UTC. SIGTERM/ny start utan EPERM eller kvarvarande lease; signerad config.get 200 och connected/applied 01:45:22 UTC. Director på `9f7f415d9896ca05b8c240f210ea64a1c30f2b04`, deploy `dep-dba30r2jnfac73e5err0` LIVE 02:36:29 UTC; health/autentiserat API och signerad Gateway config.get 200/connected/applied verifierade 02:37:34 UTC. PR237/238 ändrar inte Directors byggda kod. Modellval, disk och autoDeploy oförändrade. |

Driftkvittot ovan kommer från mergagentens kontroller, inte en ny körning i
dokumentationspasset. Det autentiserade cloudRuntime-provet gjordes i CI,
inte direkt mot produktion. Gateway/Director behövde ingen ny leverans för
PR237. Grönt CI och dessa driftprov är inte visuell läppsynkacceptans.

Klippfelet berodde på att servern gav clipMapping den nya fysiska roten
medan katalogen behåller `web/public`-alias. PR237 ansluter alla berörda
läsningar till den befintliga filresolvern `publicAssetPath`. Det tidigare
GO:t för PR236 var därför för brett; regressionen är nu rättad och täckt.

## Tal/läppsynk — separat pågående produktarbete

<a id="dragan-talstatus"></a>

Det kontrollerade Dragan-provet den 18 oktober nådde OpenClaw, korrekt
runtime-nyckel och en A40-worker i EU-SE-1. Ingen spelinsats gjordes.
Jobbet väntade 258231 ms och exekverade 1372 ms. Providerns COMPLETED
innehöll `status:failed, code:moving_worker_failed`; **ingen ljud- eller
bilddata levererades**. Tal/läppsynk är alltså ännu inte verifierad.

Bankkvitto-GET gav 200 kl. 08:39:06 UTC. Inget efterföljande arkivanrop
observerades i provets slutintervall. Direkt privat Blob-återläsning
08:54 UTC gav 1045 byte och rätt SHA-256. Exakt felorsak är okänd;
proxyframing/överföring är en hypotes, inte ett konstaterat fel.

[PR238](https://github.com/Jakeminator123/scoutgaming/pull/238) är mergad som
`4c782b3be4f49dc5743f27e3af3dfcb52e407939`, efter strukturens slutrevision.
Den ger workern säkra, tillåtna interna felkoder samt generiska timeout-/I/O-
kategorier. Okända meddelanden, URL:er och credentials exponeras inte;
cancellation och exklusiv admission bevaras. Mergagentens kod- och
CPU-containerkontroll gav 52/52 godkända tester, inklusive renderaren.
[Main-CI 39114081418](https://github.com/Jakeminator123/scoutgaming/actions/runs/39114081418) är SUCCESS och frontend på samma SHA är READY med
17/17 kontroller. Render inväntar imagepubliceringens check 39114263475
enligt tjänstens befintliga all-checks-regel; fullständigt appdriftkvitto
återstår vid denna avstämning. Detta är diagnostik, inte en bevisad läppsynkrättning.

Förseglad kodrelease:
`3bec5b4be9954d929fcc60d281b89981a7be3d7a9027008466c240b90c1e44ad`.
Lipsync2 äger publicering av en matchande pinnad workerimage och fortsatt
felsökning; mergagent äger appdriftkvittot. Ingen imagepublicering eller
nytt GPU-prov är verifierat av denna dokumentationsleverans.

### Senaste avvecklings- och budgetkvitto

Renderflaggan `CROUPIER_MOVING_SPEECH_ENABLED=0` blev LIVE 08:41:40 UTC;
Dragan-profilens eget tal är av. Den förbrukade endpointvariabeln togs bort
med Save only. Oberoende återläsning 08:44:28 UTC visade endpoint/template
404, tom workerlista och avslutad/frisläppt journalpost. Astrids min0/max1
är oförändrat. Inga GPU-resurser lämnades igång av provet.

Samma budget-ID behåller fem reservationer. Journaltaket höjdes append-only
från 4,8 till 6 USD inom Jakobs **15 USD totalt**, med tidigare leverantörs-
reserver bevarade. Reservationer är inte uppmätt kostnad eller bevis på
återstående utrymme. Före nästa redan auktoriserade prov krävs färsk kostnad,
matchande image/release, endpoint/nyckel, utrymme för högst ett nytt försök
och automatisk avveckling. Återanvänd inte borttagna endpoint-ID:n.

## Avslutsstädning och skyddat lokalt arbete

Förbrukade flyttinstruktioner, aktivitetskort och motsägande väntelägen ska
inte finnas kvar som aktiva uppdrag. Denna handoff ersätter den löpande
flyttloggen; äldre exakta kvitton finns i [Git-historiken](https://github.com/Jakeminator123/scoutgaming/blob/4c782b3be4f49dc5743f27e3af3dfcb52e407939/docs/JOHN-HANDOFF.md).
Ingen ny strukturplan eller parallell migrationslista behövs.

Gamla kodrötter är tömda i accepterad main. En äldre lokal checkout kan
fortfarande visa dem. Synka först efter kontroll av branch, egna ändringar,
ägarskap och eventuella aktiva processer. Radera verifierat förbrukade rester;
bevara osäkra original i det kanoniska gitignorerade `arkiv/<datum>/`.
`lab/data`, `web/data`, OpenClaw-data, env, råmedia, kalibrering och privata
QA-kvitton får inte raderas som en följd av källkodsflytten. Avvecklade egna
worktrees kan arkiveras efter kontroll av opushat och ignorerat arbete;
andra agenters worktrees och claims är inte del av rutinmässig städning.

## Övrigt kvarvarande produktarbete

<a id="2-öppna-kontroller-och-kända-fel"></a>

[CLOUD-MIGRATION](CLOUD-MIGRATION.md#separat-produktarbete-och-öppna-driftansvar)
är den enda listan över öppna produktfunktioner och äldre observationer.
Där finns operatörsledger/rapporter, konto/invite/reset, Admin-/lobbyluckor,
OpenClaw-funktionsprov, medieradering, backup och pausad QA. De innebär
inte att den levererade strukturflytten ska öppnas igen.

Välj prov efter ändrat beteende. Ingen generell manuell spelacceptans eller
ett fast antal spel krävs för vanlig leverans. Auth, rum/bolagsgränser,
revisioner, sparande och serverägda pengar/spelregler behåller täckning.
Hash, waveform och testpass bevisar aldrig synlig läppsynk; exakta
ljud-/videoidentiteter och befintliga godkännanden ska bevaras.

GitGuardian-läsningen den 18 oktober visade 2 öppna och 18 ignorerade
incidenter. Platsmetadata är delvis ofullständig och helhistorikskanningen
har status too_large. Grön produkt-CI betyder inte full säkerhetstäckning;
inga incidenter har ändrats av strukturavslutet.

Begrepp: [TERMINOLOGI](../apps/studio/docs/TERMINOLOGI.md).
Teknisk verklighet: [LOCAL-PRESENTATION-RUNTIME](LOCAL-PRESENTATION-RUNTIME.md).
Konfiguration: [ENVIRONMENT-VARIABLES](ENVIRONMENT-VARIABLES.md).
Återställning: [ENVIRONMENT-RESTORATION](ENVIRONMENT-RESTORATION.md).
