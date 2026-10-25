# Masterplan: selektiv Kevin-portning till mains produkt

Reviderad 25 oktober 2026 på Jakobs begäran, med läsande granskning av inloggad Admin, main och PR:ar. Ursprunglig genomgång: `34c6c22f60ac75f335f647c83af06e7d0514476b`; senaste kod-/leveransavstämning: main `547c433b9fe229974cfc262fef2c01ba4e63424f` efter #379/#386–#392/#394/#395 och tidigare #378/#380–#385. Ursprunglig plan: [PR #311](https://github.com/Jakeminator123/scoutgaming/pull/311). Den fördjupade dokumentrevisionen samlas, efter Jakobs uttryckliga begäran om push, i befintlig [PR #379](https://github.com/Jakeminator123/scoutgaming/pull/379). Utförandestatus ägs endast av [status.json](status.json), med genererad [läsvy](STATUS.md). Dokumentrevisionen #379 är mergad som `8093797cfb920f31de9e2d775d3bad50d1d7b69b`. Fortsättningen levererar en avgränsad kompatibilitetsgrind och obligatoriska befintliga tester. Full mediaacceptans och aktivitetsstatus ändras inte.

## Slutsats och verifierat nuläge

**Behåll main och färdigställ de accepterade beteendena genom dess befintliga kontrakt.** Det största återstående värdet är exakt mediebindning och verifierad användning genom Admin → publicering → spel. En generell merge av Kevin är inte en leveransmetod.

**45 % betyder 9 av 20 helt verifierade aktiviteter.** Varje aktivitet väger fem procentenheter oavsett arbetsmängd. Det betyder varken att bara 45 % av koden finns på main eller att 55 % ska importeras. J01/J02/J03/J04/K01/O01/K02/K03/J07 är VERIFIED; status och vikter ändras inte av denna granskning. Flera återstående aktiviteter har redan stora mergade delsteg.

| Underlag, kontrollerat 25 oktober | Vad som faktiskt finns på main | Återstående beslut/acceptans |
| --- | --- | --- |
| PR #334, mergad som `73f6c8f5b9035fc70c6c68594131d96aa92d9fcf` | J08:s versionerade rums-/spelkonfiguration, behörighet, scope, revisionskontroll och materialkontroll | Samlad acceptans med riktiga godkända paket/media; inte ett nytt Admin eller en ny writer |
| PR #336, mergad som `34060c4d0e3fd33c1e4040479646d7150b6d1294` | Delat bord, server-/klienttransport, återanslutning, same-PG auth och presentationsmottagare | Runtimekedja, miljö/readiness och media måste verifieras på samma kandidat |
| Kevin PR #333, utkast vid `eb6ab45509fad539463bbcb6930cc46d2d0844c2`, bas `codex/postgres-shared-table-j07` | Alla 26 ändrade sökvägar finns: 19 byte-identiska; sju vidareutvecklade på main. Refill, mottagare, idle, katalog och replay finns. De två extra fel-/replayproven kom via PR #348 (`4336c2cfca2fd9e7a09cc1b4116845d677c52f52`) | Ingen kvarvarande unik produktfunktion identifierad i filjämförelsen. Granska som ersatt PR med ägaren; merge eller stängning utförs inte av denna plan |
| Kevin PR #315 / #323, öppna utkast mot `kevin-merge-admin` | Teständringar i Kevins gamla app, inte saknad produktimplementation. Main har deterministiska fixtures samt explicit PR #323-prov för paus/försäkring och stabil kommandoåterspelning | Återanvänd endast en bevisad saknad testavsikt i mains testkontrakt; importera inte SQLite-fixtur eller legacyapp |
| PR #345, mergad som `a2d461a1e8c28e195b4e197dff18f0b7955e3185` | Fyra K07-testfiler för idle, bordsbeteenden, limits och restart | Registrerade i obligatoriska `gameplay/shared-blackjack` genom #386 med borttagna opt-in-undantag och grön CI på `a1bd30587eae0734ae37243a87e578a8e7f13d15`. Restartprovet återanvänder minnesstore; det är inte process-/Postgresbevis |
| K04, PAOW och operatörsytan | Trelagers-matte, filmad tidslinje, serverkedjad idle och kort-/chipsskalning finns; operatörsytan levererad via #364/#366. #382 dokumenterar PAOWs 24 exakta idleoriginal i publicerat West Bet-paket revision 2 och avgränsad faktisk videouppspelning | Återanvänd import/publicering. Kvittot omfattar ingen insats eller full spelrunda, inte heller alla 24 klipp manuellt. Givfilmer/repliker och PAOW-filmprofil med avvikande landmarks behöver fortsatt acceptans |

PR #333:s sju avvikande filer har granskats som kod, inte bara räknats: replay har flyttats till delat kontrakt, mottagaren läser under samma transaktion, koordinatorn har starkare auth-/configgräns, tester har kompletterats och SQL-provköraren bevarar tidigare kontroller. Det finns därför inget belägg för att en helmerge ger ytterligare användarvärde.

**Isolerad provmiljö, 25 oktober:** efter Jakobs uttryckliga utökade molngodkännande är granskade scheman, egna minimala roller och tomma projekt-/administrations-/katalogregister installerade i `croupier_staging`, PG18.6, Frankfurt, fast 0,25 CU/300 s. Appens egen inloggning verifierar readiness och nekad DDL/ledger-skrivning. Separat tom restoredatabas och eget Vercel-projekt/privat Blob finns. [Exakt resurs- och installationskvitto](../docs/ENVIRONMENT-RESTORATION.md#godkänt-molnsteg-och-faktiskt-installationskvitto-25-oktober) skiljer detta från återstående appdrift, Admin→spel och riktig restore. Ingen historisk bank eller gammal QA återinfördes; 45 % ändras inte.

**Rensning utan återinförd legacy, 25 oktober:** v3-kontrollen i [PR #390](https://github.com/Jakeminator123/scoutgaming/pull/390) ersätter CI-bygget av den gamla kombinerade v2-/Studio-imagen och kravet på lokal bootstrapdata. PR390 är mergad som `d9ef40c8` efter full CI; Linux-bygge, cache och nätverksfritt konfigurationsprov har passerat. PR #391 är mergad som `2faa327e` efter full CI `40211795949` och faktisk Studio-ledger-readiness. Den explicita tomma runtimekatalogen gör dessutom en ny molninstallation oberoende av historiska Astrid-/Emil-register. Kodproven går från tom projektmodell till syntetisk dealer, ordinarie uppladdning, fryst publicering och spelentré. Läsarkompatibel deploy ska ske före init. Inget av detta är full Neon/Blob- eller spelacceptans; [installationsordningen](../docs/ENVIRONMENT-RESTORATION.md#konkret-fortsättning-ännu-inte-utförd) och 45 % gäller fortsatt.

**P6- och runtimeavveckling levererad:** #392 tar bort den pensionerade SDK/router/klientkedjan; #394 tar bort kombinerad Dockerfile, Studio-process, Next-förkontroll, intern Lab-proxy och äldre diskbunden QA-transport. Ett kvarvarande CI-krav på Studio-filer i Render rättades till Vercels verkliga tjänst. #395 rättar native-Admin till en origin i explicit unified-läge och tillåter spelstart utan AI-relä när AI-media är av. Auth, scope, Neon, privat Blob, aktiv talbudget och serverns ekonomi består.

| Delsteg | Verifierad leverans | Kvar |
| --- | --- | --- |
| #392 P6 | Main `7910d1b`; full CI `40213762922`; senare Render `ebb6b91f` återläst via faktisk health/version | Samlad runtime-/restoreacceptans |
| #394 runtime/QA/CI | Main `9bfb680e`; full CI `40215199058`, Docker/cache/Linux `40215199267` | Samlad start/drain/restore-acceptans |
| #395 Admin och AI-krav | Main `547c433b`; full CI `40215534400`, Docker `40215534405`, rootintegration 148/148; Vercel READY och inloggad Admin-återläsning | Isolerad Admin→spel-/molnacceptans |

Full CI omfattar alla åtta grupper, faktisk SQL/omstart/HTTPS och produktionsledger-readiness. Inga checks undantogs. Dessa är J05/J06/J08/K06-delbevis; 45 % ändras inte. Resursförslaget är uttryckligen godkänt: Render 1 CPU/2 GB, en instans, ingen disk, manuell deploy, stopp efter prov/högst 24 timmar. Ingen produktionsdata eller AI/GPU ingår. Den gamla QA-tjänsten förblir stoppad.

## Prioriterad väg till 9/10

Poängen gäller **nytta för main**, inte ekonomisk avkastning eller migrationsprocent. Tabellen beställer bara verifierade luckor. Ingen helmerge av Kevin eller återuppbyggnad av redan fungerande Admin ingår.

| Prio / nytta | Befintligt eller pågående | Konkret återstående arbete i mains modell | Godkänt resultat och gräns |
| --- | --- | --- | --- |
| 0 · 10/10 | #386:s v28 / `idleRotation: pose-graph-v1` är verifierad live på Render `23debde7` | #387 har levererat och driftsatt Admins readiness före SQL för aktiv, arkiverad och fryst rotation. 71/71 riktade prov, oberoende kodreview och grön full CI; #388 kräver faktisk migrationsreadiness i slutgrinden. Återanvänd leveransen och kvittona | Äldre runtime nekar skrivning; policy utan rotation behåller tidigare krav. Ingen featureeskalering i transaktionen. Grinden bevisar inte full restore; återgångskoden måste kunna läsa sparat format |
| 1 · 10/10 | Klippkarta, poseklassning och trelagersspelare finns | **Admin → Klippkarta**: bind accepterade UUID/hash, posevariant, track, kontakt- och handfrigöranderuta genom befintlig register-/publiceringsväg. Utred PAOW:s motstridiga landmarks före aktivering | Två följande uppspelningar i faktiskt spel med separat bakgrund, dealer och bord. Osäkra givfilmer/repliker förblir avstängda; inget nytt lokalt medieregister |
| 2 · 10/10 | #334/#336/#364/#366 finns på main; Admin visar redan rum, utkast, material och spelinställningar | **Admin → Spelbolag & rum**: färdigställ K06/J08-kvittot för sparning → återläsning → granskning → publicerat paket/config → rätt spelversion. Använd scoped roomOverrides och befintliga writers | Fel bolag, roll, rum, revision och media nekas. Pågående hand behåller avtalad version. Gemensam mall, rumsval och paketets dealerpolicy får inte förväxlas |
| 3 · 9/10 | Fyra K07-filer från #345 är obligatoriska efter #386 | Testregistreringen är levererad. Återanvänd proven i kandidatens regression; K07:s samlade samtidighets-/molnacceptans återstår | CI visar att filerna körs. Minnesrestart räknas endast som regel-/koordinatorprov; verklig PG-/processbeständighet har separat kvitto |
| 4 · 8/10 | #378/#381 levererar rotation i verkliga Körregel-panelen; #382 kvitterar 24/24 exakta media, sparad policy och publicerat West Bet-paket revision 2 | Återanvänd leveransen och dess kvitto. Komplettera endast återstående acceptans: två följande spel, avbrott/återgång till talpose samt berörda rum. Ingen ny editor, omimport eller ompublicering beställs av planen | 45 sekunders dokumenterad liveuppspelning visar åtta klipp med bildkvitton och nio observerade identiteter; ingen insats/full runda. 24/24 urval är offlinebevis. Förhandlat runtimestöd och full spel-/mediaacceptans är fortfarande separata krav |
| 5 · 9/10 | #380/#383–#385 har levererat gemensam Sceneditor, kopiering mellan bordsprofiler och separat publicering av sparad geometri | Återanvänd **Studio → Sceneditor** på `/admin/scenes` och `publish-scene-layout`. Komplettera endast kvarvarande K06/J08-acceptans för delad mall, berörda rum, materialval och revisionskonflikter; återinför inte `update-scene-layout` eller rumssidans gamla geometriändrare | PR385 kvitterar publicering/återläsning samt 320/390 px och desktop. Handoff kvitterar en komplett Dragan-demohand. Materialval publiceras separat; bortkastat redundant utkast återställs inte. Fysisk Safari och sju samtidiga händer är obevisade och provas när respektive acceptanskrav gäller |
| 6 · 8/10 | Talplatser, inspelat tal och committade spelhändelser finns | K05/K04: attestera ett accepterat talfack med exakt text, ljud, video, indexhash, poser och kalibrering genom mains befintliga tjänster | Visuellt godkänd synk och rätt händelsetiming. Saknad/sen media påverkar aldrig saldo/utfall. Inga tysta språk-/dealerfallbacks eller generativ worker utan separat beslut |
| 7 · 9/10 | Server-v3, Neon och privat Blob är befintlig produktväg | J05/J10/K07/O02: samla samma kandidats start/readiness, samtidighet, reconnect, avbruten laddning, retry och kompatibel restore i den godkända isolerade molnmiljön | Kvitto anger Vercel-/Render-version, Neon-scope, Blob-namnrymd och paket/configrevision. Kodtest, lokal PG och mediaacceptans hålls åtskilda enligt tabellen nedan |

Prio 3:s registrering är utförd; den integrerade medieacceptansen återstår. #378/#381:s merger ersätter inte kompatibilitets- eller liveacceptans. Mergade #380/#383/#384/#385 återanvänds: Studio → Sceneditor (/admin/scenes) är enda placeringseditorn. publish-scene-layout publicerar geometri från kanonisk sparad mall med projekt-, paket- och registerrevisioner; materialutbud publiceras separat. Den separata bolagsgeometrin och update-scene-layout är borttagna och ska inte återskapas. PR385:s driftkvitto och handoffens kompletta Dragan-demohand är delacceptans; fysisk Safari och sju samtidiga händer är inte verifierade. Redundant Dragan-materialutkast är kastat, medan aktuella material, fem bordsprofiler och PAOW-data bevaras. Sena Kevin-fixar kräver först ett reproducerbart gap i main. Extra dealers, språk, repliker, hela backoffice/roulette och generativ moving-lipsync/GPU skjuts upp när nyttan är svagt belagd.

**9/10 ges först när samma kandidat uppfyller alla relevanta krav ovan:** en överenskommen dealer/rumskombination genom Admin till två följande spel; korrekt kortkontakt och valt godkänt tal; negativa behörighetsfall; exakt en ekonomisk effekt; obligatorisk regression; särskild mobil-/mediaacceptans och fungerande kompatibel restore. Det är ett kvalitetsmål för demon, inte ett real-money-godkännande eller ett krav på full Kevin-paritet.

## Motivering och när migreringen är klar

Urvalet prioriterar verifierat användarvärde och liten anpassningsrisk. Befintlig kod och nya driftkvitton ska minska kvarvarande arbete; äldre delsteg får inte beställas på nytt.

| Beslut | Motivering |
| --- | --- |
| Porta beteenden genom mains befintliga tjänster | Main äger autentisering, ekonomiska effekter, Neon, Blob och trelagersspelaren. Att kopiera Kevins app eller lagring skulle skapa konkurrerande sanningar |
| Komplettera Admin och dess scoped writers | Samma behörighet, rum-/bolagsgräns, revision och frysta paket gäller från redigering till spel. Ett valt rum begränsar inte automatiskt en gemensam mall eller paketets dealerpolicy |
| Återanvänd #333:s redan representerade innehåll och #378/#381/#382 | En ny merge, import eller editor ger inget extra värde när funktionen redan finns. Återstående skillnader måste kunna visas i main |
| Behåll PostgreSQL/SQL och avgränsade befintliga tester | Neon använder SQL. Förbjuden återgång är ett nytt lokalt produktregister eller en alternativ publiceringsväg; rena kodprov och befintliga isolerade PG-prov är användbara delbevis |
| Kräv explicit kompatibilitet och exakt mediaacceptans | Grön CI eller hash bevisar inte äldre läsares stöd, kortkontakt, läppsynk eller två följande spel. Osäkra giv-/talfilmer förblir avstängda |

| Vad får kallas klart? | Krav och avgränsning |
| --- | --- |
| Plan-/dokumentrevisionen | Reviderad masterplan och K05, motiv, aktuella kvitton och kontroller är mergade i PR #379. Dokumentleveransen är klar; funktionernas återstående acceptans består |
| Ett avgränsat funktionsdelsteg | Dess accepterade beteende är implementerat i mains modell och har versionsbundet kvitto för hela just det delsteget. #382 är ett sådant avgränsat PAOW-kvitto, inte färdig K04/K05/K06 |
| Kevin-migreringen enligt beslutad omfattning | Samtliga 20 aktiviteters gällande acceptanskriterier är verifierade och registrerade i status.json, inklusive O02:s oberoende samprov och O03:s leverans-/drift-/restorekvitto. Ett bortvalt krav kräver uttryckligt scopebeslut och dokumenterad motivering; det får inte tyst strykas eller räknas som VERIFIED |
| Teknisk Neon-/Blob-flytt | Har separat avslut i [molnöversikten](../docs/CLOUD-MIGRATION.md#teknisk-register-runtimeflytt-avslutad-i-produktion). Det avslutet får inte blandas ihop med Kevins återstående funktions- och medieacceptans |
| Main på 9/10 | Bedömning mot kvalitetskraven ovan. Inte samma mått som 45 % aktivitetsstatus, automatiskt 100 % migration eller ett godkännande för riktiga pengar |

**Ja, migreringen kan kallas klar när den avgränsade planen faktiskt är genomförd och verifierad.** Full kopiering av Kevin, extra dealers/språk eller en generativ worker krävs inte. Dokumentpushen ensam räcker inte: 45 % (9/20) står kvar.

O02/O03:s slutkvitto ska identifiera en gemensamt granskad release med kompatibla Vercel-/Render-versioner, schema, paket/config och exakta media, samt faktisk Admin → publicering → spel, negativa behörighets-/revisionsfall, två följande spel och kompatibel återställning. Frontend och backend behöver inte ha identisk commit om endast klientkod ändrats; deras kompatibilitet och faktiska driftsversioner måste vara belagda. Denna plan ger inget nytt mandat att testa på riktiga användardata eller ändra produktion.

## Förnyad Admin- och PR-granskning 25 oktober

Inloggad, läsande granskning av `www.scoutgaming.tech/admin` genomfördes tidigare den 25 oktober, före #382:s publiceringskvitto: Klippkarta, PAOW:s idlefack/Körregel och Spelbolag & rum för Dragan test respektive West Bet. Inga data sparades och inga spel startades av denna granskning. Följande UI-observationer beskriver den tidpunkten; #382 kompletterar dem med ett senare rapporterat driftkvitto.

- PAOW:s idlefack visar **34 filer**, standard **andas**, och befintlig editor för basloop/beteendeklipp. Giv-/visnings-/talfack visar obundet material trots att filer finns. Antalet filer bevisar varken rätt urval eller acceptans.
- Den tidigare rumsytan visade separat **Bakgrund / Dealer / Bord** och ett för gammalt Dragan-materialutkast. Senare #385 ersätter dess geometriändrare med Sceneditorn; det redundanta utkastet är kastat enligt handoff. Observationen beställer varken återställning av utkastet eller av den borttagna editorn. Materialval och geometri publiceras separat.
- Main-koden bekräftar Neon-registret (`neon-video-registry.mjs`), privat Blob (`cloud-media-store.mjs`) och befintliga Admin-tjänster (`studio-native-runtime.mjs`). Molnstartens gränser i `ops/cloud/config.mjs` kräver Postgres, Neon-policy och Blob. Kvarvarande offline-/SQLitekod är inte förebild för portningen.

| PR och fryst head vid granskning | Bedömning och återstående gräns |
| --- | --- |
| [#378](https://github.com/Jakeminator123/scoutgaming/pull/378) · `84b9c2fc60888f07286e46280afb1e2ca53de335` · mergad som `51165e9a5e2625caab1b5a8d12f1e528c99b66bc` | Återanvänder Admin, exakt hashurval, Neon-transaktion/CAS och fryst paket. **Kvarstående kompatibilitetsfynd:** `rotation`/`use: rotation` läggs till i strikt idleformat utan ändring av capability-/readinessfiler. Föregående main-läsare på `34c6c22f` avvisar fältet; generic readiness bevisar inte detta stöd. Kräv explicit runtimegrind och negativt prov med gammal läsare före framtida sparning/publicering eller rollback. Kontrollera paketets dealerpolicy och alla påverkade rum |
| [#380](https://github.com/Jakeminator123/scoutgaming/pull/380) · `d51c7c135f6ed8aadeeddb6e9bbf4a3198682b91` · mergad som `aad0ba3a0c5230ebbca50dfff0649b4dafd45798` | Historiskt layout-/utkastdelsteg med v27. Den separata `update-scene-layout`-vägen ersätts i #385; återanvänd slutlösningen nedan. `discard-draft`, direkt sparning och CAS kvarstår som avsedda beteenden |
| [#381](https://github.com/Jakeminator123/scoutgaming/pull/381) · `1cd40af4461654449259e6f07fe5137f7ef0e500` · mergad som `e57ed4d702378f20d5d29e398b0aec812a315f86` | Kopplar #378:s exakta 24-klippsurval till verkliga `StudioPolicyPanel`, skyddar aktiva sekvenser och ger återgång till basloop. Klient-/teständring; löser inte saknad runtimegrind. Behandla funktionen som levererad kod med separat återstående helflödes-/mediaacceptans |
| [#382](https://github.com/Jakeminator123/scoutgaming/pull/382) · `84859b7cac9ac31d3b680afaf20f53526b0a99fa` · mergad som `2be88119d2f342b7a9cf6725dab1ab75d6a09d52` | Handoffkvitto från utförandeagenten: Vercel READY på `e57ed4d7`, Render live på `51165e9a`, West Bet revision 2 och 24/24 exakta media. 45 sekunders faktisk uppspelning, ingen insats/full runda; inte egen omkörd acceptans. Sparad PAOW-policy ska bevaras. Klientändringen #381 kräver inte identisk backend-SHA |
| [#383](https://github.com/Jakeminator123/scoutgaming/pull/383), [#384](https://github.com/Jakeminator123/scoutgaming/pull/384), [#385](https://github.com/Jakeminator123/scoutgaming/pull/385) · slutlig main `0e457589e84dcef3147ee54f01883ce5e459e356` | Mergade #380/#383/#384/#385 återanvänds: Studio → Sceneditor (/admin/scenes) är enda placeringseditorn. publish-scene-layout publicerar geometri från kanonisk sparad mall med projekt-, paket- och registerrevisioner; materialutbud publiceras separat. Den separata bolagsgeometrin och update-scene-layout är borttagna och ska inte återskapas. PR385:s driftkvitto och handoffens kompletta Dragan-demohand är delacceptans; fysisk Safari och sju samtidiga händer är inte verifierade. Redundant Dragan-materialutkast är kastat, medan aktuella material, fem bordsprofiler och PAOW-data bevaras. Koden har lästs för sparad-mall-publicering och bevarande av material/geometri; livekvitton återanvänds från utförandeagenten och är inte omkörda av dokumentgranskningen |
| [#379](https://github.com/Jakeminator123/scoutgaming/pull/379) · denna dokumentleverans | Samlar masterplan, K05, aktivitetsnoteringar, motiv och slutkriterier efter Jakobs begäran om push. Ingen produkt-PR eller aktivitet markeras färdig av dokumentleveransen |
| [#352](https://github.com/Jakeminator123/scoutgaming/pull/352) · `93edf200ea7d546362050840fcfc369fe664b41d` · Jakob, utkast | Review-workflow och handoff; ingen saknad Kevin-produktfunktion |
| #333 / #315 / #323 · Kevin, utkast | Oförändrade produkt-/testslutsatser i nulägestabellen. #333 har annan integrationsbas; #315/#323 baseras på `kevin-merge-admin`. Ingen av dem är en automatisk mergekö till main |

#378:s urval är separat fryst på `kevin@f664c54dfce870a4ea048ed93dfda181d0df9600`. Det godkänner inte automatiskt alla senare Kevin-commits eller flyttar K01/O01:s baslinje. Kontrollera PR-head, ägare, CI och kvarstående fynd på nytt inför faktisk integration.

## QA, SQL och lagring utan återinförd legacy

**Neon är PostgreSQL och använder SQL.** Förbudet gäller att återinföra SQLite, filbaserad produktstate eller direktdatabasvägar som ersätter Admins auth, scope, revisioner och publicering. Parameteriserad SQL i mains Postgres-adapter är avsedd; regelkärnan ska fortfarande vara fri från databasåtkomst. En gammal beställning av en SQL-läsroll är ingen ny installations- eller behörighetsinstruktion.

| Nivå | Tillåtet, befintligt verktyg | Vad provet kan bevisa | Vad det inte får bli |
| --- | --- | --- | --- |
| Kod/kontrakt | Mains rena tester och minnesfixtures, syntetisk slump/tid, statisk läsning av kod/SQL-migrationer | Regler, validering, UI-tillstånd, fel-/replayfall | Nya SQLitefixtures, Kevins lokala app, bevis på Neon-beständighet eller godkänd video |
| Avgränsat Postgres-prov | Befintlig ägd, tillfällig PG-harness i test/CI när lås/rollback/processfel behöver isoleras | Transaktions- och processbeteende för den angivna testmiljön | Ny lokal produktmiljö, kopierad produktionsdata, nya produktionsroller eller att loopback-harnessen riktas mot Neon |
| Molnintegration/acceptans | Befintlig godkänd isolerad Neon-resurs/scope och privat Blob-namnrymd, mains Admin/API och verkliga spelare med syntetiska användare | Admin → Neon → fryst paket → auktoriserad medieleverans från privat Blob → spel, med identifierade versioner | Produktionstest med riktiga konton, lokal mapp som ersätter Blob, eller obeställd resurs-/DDL-/behörighetsändring |

- Normal `apps/studio/start.mjs` öppnar den publika produkten; `--offline` är endast en explicit jämförelsefixture. Återinför inte gamla connected-local-flaggor, lokal QA-kalibreringspanel eller alternativ produktstart för migrationens skull.
- En befintlig `--media-root`-fixture, renklonstart eller lokal frontendöverskrivning kan vara ett avgränsat kod/UI-prov. Den bevisar inte Neon-isolering, Blob-auth/range/hash eller rätt driftsatt Vercel-/Render-version.
- Metadata, ägarskap, godkännanden, UUID/hash och publicerade referenser hör hemma i Neon; originalklipp i privat Vercel Blob. `cloud-media-store.mjs`:s verifierade temporära cache är härledd data, inte ett nytt register. `services/game/public/local-presentation.mjs` är en aktiv del av molnspelaren trots namnet; behåll dess gemensamma kontrakt.
- För varje skrivning: identifiera befintlig tjänst, actor/roll, operatör/rum, scope, förväntad revision och exakt media. Läsning av källkod eller migrations-SQL är inte databasåtkomst. Operativ SQL-läsning använder endast befintlig avsedd anslutning/scope; en direkt SQL-uppdatering får inte ersätta Admin-publicering.
- Befintliga godkännanden gäller sitt exakta mål och sin omfattning. Daterade resursförsök, schemamanifest och “AV”-noteringar i [återställningsdokumentet](../docs/ENVIRONMENT-RESTORATION.md) återläses mot dagens mål; de är inte aktuella körinstruktioner. Skapa inget nytt testlandskap bara för att plantexten nämner QA.

**Verifieringsgräns:** annat test-/Adminarbete bevaras. Saknade låsta beroenden i den rena arbetskopian är inte produktfel. #379 var en dokumentleverans; Jakobs därefter beställda implementation omfattar #386 och den avgränsade rotationsgrinden. Miljö-/medieacceptans ersätts inte av dessa kodprov.

## Aktuell requestkedja och runtimegräns

Kodkarta kontrollerad på main `23debde7155346e30ee5a3f3dfbe54cd09ea2789`. Render `croupier-v3` bygger `ops/cloud/Dockerfile.game`; ingen Studio-/Next-process startas där. Barnprocessen som äldre kod kallar `web` är `services/game/server.mjs`. Vercels webb- och Studio-tjänster behåller sina serveransvar. Karta och kontraktprov är delbevis, inte full J05/J10-acceptans.

| Konsument | Aktiv väg och lagring | Bevarad gräns |
| --- | --- | --- |
| Admin, partner, lobby och Studio-API | Vercel middleware → `platform-routing.mjs` → `apps/studio` och delade registertjänster → Neon | Roll, scope, revision och publicerat paket |
| Autentisering, profil och spelkommandon | Signerad Vercel-ingress → Render-gateway → `services/game` → Postgres-adapter | Serverägda konton, kort, saldo och transaktion |
| Game-entry och launch | Vercels game-entry/launch → behörighetskontrollerad motor och publicerat rum/paket | Klientval ger ingen konfigurationsauktoritet |
| Delat rum, WebSocket och strömmar | Exakta `packages/server-transport/paths.mjs`-vägar → Node-upgrade → Render-dispatcher | Session, Origin/Host, rumsisolering och drain; separat runtimeaktivering gäller |
| Originalklipp och frysta presentationer | Auktoriserad resolver → Neon-identitet och privat Blob | Exakt UUID/hash och paket, auth/range; cache är härledd |
| Capability, hälsa och version | Exakta läs-endpoints på Render-gateway → motor | v1–27 oförändrade; förhandlad v28 för rotation |

**Verifierat:** 58 image/config/ingress/version-prov samt två shutdown-prov passerar lokalt. Tre Linux-SIGTERM-prov är uttryckligen överhoppade på Windows; bedöm dem via kandidatens Linux-CI. Renderdeploy `dep-dbf1qie7bikc73bsg650` är live på ovanstående SHA. Faktisk HTTP-läsning gav health 200, samma version-SHA, v27 200 och v28 200 med `idleRotation: pose-graph-v1`. Ingen schema-, paket-, policy- eller flaggändring ingick.

**Rotationsgrinden:** denna komplettering kräver v28 före SQL för aktiv, arkiverad och fryst policy, inklusive `use: rotation`. 71/71 riktade prov och oberoende kodreview utan blockerare. Admins CI/deploykvittens redovisas separat i handoffen; återgång måste också kunna läsa redan sparad policy. Prio 0:s implementation ersätter det tidigare kompatibilitetsgapet men bevisar inte full restore.

## Anpassningsgräns: main bestämmer formen

Konfigurationen förenklas också enligt samma princip: explicit unified-UI ska
använda en public HTTPS-origin även i native-Admin. Inspelat spel med AI-media
av ska inte kräva en separat AI-tjänst; okonfigurerad chatt avvisas öppet.
Kodrättningarna behåller behörighet, scope och aktiva AI-krav. De måste nå
grön CI och kompatibel drift innan K06 kan använda dem; inga aktivitetsprocent
eller media-/talattesteringar följer automatiskt av ändringarna.

```text
Admin / scoped roomOverrides
    → validerad, fryst rum-/paket-/configversion i Neon
    → auktoriserad spelstart och serverägd spelmotor
    → committad händelse/outbox
    → exakt godkänd media i privat Blob
    → bakgrund → dealer → bord → serverns kort och UI
```

- Mains server äger regler, sko, kort, wallet, idempotens och tidsövergångar. Presentationsfel får aldrig skicka om en ekonomisk handling.
- Main äger N1/N2/spelarsessioner, Neon-transaktioner, scoped writers, UUID:n, Blob och frysta paket. Kevins SQLite, filregister, cookies, fallbackdealer och monolitiska server följer inte med.
- `/admin` är arbetsytan, `/lobby` katalogen och `/game` den aktuella publika spelstarten. Bevara de interna autentiserade `/play/{game}`-kontrakt som fortfarande har konsumenter. Återinför inte Control, lokal kalibreringspanel eller borttagna produktstarter.
- Samma funktion med annat namn räknas som befintlig. `pos1` → `box0`, `posdealer` → `dealer-up` och `hole/flip` → utdelning/visning av dealer-hole behöver ingen ny begreppsmodell. Design, uppladdad layer-UUID, dealer, operatörsägt rum och fryst paket hålls isär.
- Ställ uppskjutna G13-repliker, extra språk/dealers, större variantpooler och Kevins kompletta backoffice/roulette åt sidan. Svagt belagt värde med hög risk för legacy eller begreppsförvirring innebär **avstå**.
- Färska PR-/ägar-/SHA-kontroller gäller vid eventuell senare integration. Denna revision ger inget merge-, DDL-, import-, flagg-, deploy- eller GPU-mandat. Produktionsschema 008/009/010 och flaggvärden måste återläsas inför ett faktiskt driftsbeslut; 22 oktobers “AV” är historik, inte ny verifiering.

## Frysta utgångspunkter och versionsgräns

| Källa | Full SHA | Användning |
| --- | --- | --- |
| Main, första granskningen 25 oktober | `34c6c22f60ac75f335f647c83af06e7d0514476b` | Ursprunglig PR-/filjämförelse och prov av gammal idle-läsare |
| Main efter #378 | `51165e9a5e2625caab1b5a8d12f1e528c99b66bc` | Mergad med samma granskade head; källunderlag, inte en ny produktändring från denna dokumentrevision |
| Main vid sista statusavstämningen | `23debde7155346e30ee5a3f3dfbe54cd09ea2789` | #379:s plan och #386:s v28/testregistrering är mergade. Render v28 återläst; Admingrinden levereras i #387. Tidigare scen-/PAOW-leveranser bevaras; full restore och media-/samacceptans kvarstår |
| Ursprunglig main / jakob-gren 21 oktober | `15988f32fd572c453d2189502acbe324c4566815` | Historiskt plan-/kontraktsunderlag; inte dagens main |
| kevin-merge-admin | `5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc` | Accepterad fryst källa för K01/O01; flyttas inte automatiskt |
| kevin-staging, äldre analys | `238d6dd681745ca87a813b969443e7edee3f820b` | Historiskt underlag |
| PAOW-importens separata källfrysning | `c713875923cd854b26f89c1db0d0f47064619c1d` | Redan dokumenterad import; ersätter inte generell migrationskälla |
| kevin-staging, läst 25 oktober | `3e76d79e264a8abd07bc7996bb3ec75cc925341e` | Jämförelseunderlag, inte automatiskt accepterat delta |
| kevin, läst 25 oktober | `f664c54dfce870a4ea048ed93dfda181d0df9600` | 40 commits efter staging; varje nytt beteende granskas separat |

Historiska kontrakt, delkvitton och de 20 aktiviteternas beroenden nedan bevaras. “Befintlig”, filrader och “mål” inne i det daterade O01-underlaget avser dess angivna SHA; läs nulägestabellen ovan innan ett gammalt delsteg beställs på nytt. Senare datum ger inte i sig media- eller produktionsacceptans.

## Vad ”bäst av allt” betyder

| Område | Bas/urval | Konkret avveckling |
| --- | --- | --- |
| Admin och publicering | Main; förbättra användarflödet, behåll aktiva tjänster | Ersatta Control-sidor, formulärkopior, gamla entrypoints och deras enda tester |
| Spelkatalog och launch | `/lobby` + `/game` + serverkontrollerat rum/paket | Dubbla kataloger och bevisat ersatta starter; bevara aktiva autentiserade launchkontrakt |
| Regelkärna | Välj verifierade regler per funktion | SQL, HTTP, filer, UI, video och timers inne i själva regelkärnan |
| Delat bord och spelklient | Kevins dokumenterade beteenden som klarar K01/O01 | Kopierat auth-/wallet-/lagringssystem, hårdkodade bord/video och lokala produktregister |
| Data och identitet | Mains Neon, serverägd wallet, befintliga scoped writers | SQLite som produktfallback och bevisat oanvända tabeller efter konsumentavveckling |
| Media, tal och idle | Befintliga exakta identiteter och frysta paket i Neon/Blob | Oanvända V1-klipp från Kevin återimporteras inte; inga parallella fillager |
| Lokal utveckling | Befintliga avgränsade tester enligt QA-tabellen ovan; normal produktväg är molnet | Nya lokala produktregister, SQLitefixtures och dolda produktstarter; behåll aktiva gemensamma spelarmoduler oavsett filnamn |
| Test och CI | Regler, auth, isolering, samtidighet, sparning, publicering | CSS-/sträng-/antal-lås för pensionerad implementation och redundanta byggjobb |

Dagens publika ingångar och interna launchkontrakt framgår av anpassningsgränsen ovan. J04:s äldre routekvitto är versionsmärkt; senare PR #358/#360 gör `/game` till aktiv ingång. En URL-radering får inte radera serverns paket-, ägar- och autentiseringskontroller. `/studio` är en teknisk basePath, inte ännu en produkt.

## Arkitekturkontrakt för den befintliga porten

K02/K03/J07 har redan portat regelkärna, bordstjänst och Postgres-adapter. Följande gränser styr kompletteringar; de beställer inte en andra omskrivning av samma motor. Kevins nyare deltan granskas som beteendereferenser mot dessa kontrakt.

Målgränser:

1. **Regelkärna:** tillstånd + kommando + explicit slump/tid → nytt tillstånd + spelhändelser. Ingen databas eller nätverksåtkomst. Reproducerbar med samma ingångar; produktionsslumpen försvagas inte.
2. **Bordstjänst:** sessioner, platser, deadlines, återanslutning, kommandon och idempotens. Tiden drivs utifrån; schemaläggning ägs här, inte av klienten.
3. **Lagringsadapter:** Postgres-transaktioner och lås för både delat bord och berörda spelare. Wallet, sko, resultat och ledger måste förbli konsistenta vid samtidighet och omstart.
4. **Presentation:** översätter committade spelhändelser till publicerade media-/talkontrakt. Misslyckad video eller tal får inte ändra utfallet eller debitera igen.
5. **Admin:** producerar validerad, versionerad konfiguration. Aktiva sessioners versionspolicy bestäms i O01; inga halvpublicerade ändringar mitt i en hand.

**Regelkärnan hålls fri från SQL; lagringsadaptern använder mains Postgres/Neon.** Ingen ny SQLitefixture eller alternativ lagringsväg beställs. Befintliga isolerade PG-prov får användas för avgränsade transaktions-/processbevis enligt QA-tabellen; de ersätter inte acceptans av den aktuella molnkedjan.

## Etapper, ansvar och procent

Varje godkänd aktivitet väger 5 procentenheter. Etappernas mål är kumulativa. Måttet avser verifierade leveranser, inte arbetsvolym eller utlovad tid. En större aktivitet kan därför ta längre tid utan att procentsiffran ökar. Förberedelser får gå parallellt enligt beroendena i status.json; en etappgrind blir inte godkänd förrän den och tidigare etapper är klara.

| Etapp | Aktiviteter | Synligt resultat/grind | Etappmål |
| --- | --- | --- | ---: |
| E1 | J01 J02 K01 O01 | Förbättrad Admin-publicering med sparning/återläsning, ersatt Control-kod borta, modulkontrakt överenskomna | 20% |
| E2 | J03 J04 J05 J06 | En Admin och en lobby; aktiva launchkontroller bevarade; runtime och tester följer produkten | 40% |
| E3 | K02 K03 J07 K04 | Kevins utvalda spel kör genom rena kontrakt och mains Postgres-adapter i isolerad miljö | 60% |
| E4 | J08 K05 J09 K06 | Admin styr publicerad konfiguration och rätt media; avvecklingsmigrering granskad och provad isolerat; produktions-DDL återstår till O03 | 80% |
| E5 | K07 J10 O02 O03 | Oberoende integration, exakt-head-granskning, erforderlig migration, leverans och faktisk driftkontroll | 100% |

- [Jakob: J01–J10](jakob-main-migrering/AKTIVITETER.md): plattform, Admin, lagring, routes, CI och städning.
- [Kevin: K01–K07](kevin-ks-migrering/AKTIVITETER.md): spelregler, delat bord, spelklient och mediakontrakt.
- Orkestratorn äger O01–O03, integration, beroenden och status. En agent implementerar, en annan granskar samma SHA. Högst ett avgränsat uppdrag per agent åt gången.

### Beslutsmandat och frågepott

Jakob gav 21 oktober orkestratorn mandat att avgöra mindre frågor inom den
beställda migreringen. Reversibla val för UI, navigation, filstruktur och
implementation behöver inte invänta Kevin. Grundkedjan prioriteras: Admin
sparar och publicerar, lobby väljer rätt rum, autentiserad launch startar
demospelet och återanslutning återläser rätt tillstånd.

Oberoende ändringar genomförs parallellt med tydligt filägarskap och separat
granskning. Gemensamma kontrakt, samma skrivvägar/index och beroendeintegration
hanteras sekventiellt. En verklig osäkerhet om auth, reservation/debitering,
spelutfall eller dataförlust löses före berörd inkoppling; den stoppar inte
oberoende Admin-städning. Befintliga ägarskaps- och produktionsgränser gäller.
Tester för avvecklat beteende ändras eller raderas; verifieringen fokuseras på den aktuella produktens beteende och berörda risker.

| Frågepott | Hantering | Blockerar grundmigreringen? |
| --- | --- | --- |
| Verklig aggregator och dess API | Separat senare integration; demo och explicit walletgräns är redan beslutade | Nej |
| Ytterligare externa tjänster eller fördjupad rapportering utöver överenskommen grundfunktion | Dokumentera konkret behov här när det uppstår; ingen parallell implementation utan behov | Nej |
| K02:s reserverad konsumtion kontra ny fri insats | Avslutad sakfråga: rättningsdelta0493af3e läsgranskat, exakt head har grön CI39660600012; K02 är VERIFIED | Finansieringsfyndet blockerar inte längre |
| K03:s reservationsåterhämtning | K03 är VERIFIED som isolerad port påb8e1c957; faktisk adapterverifiering återstår i J07 | Ingen kvarstående blockerare i rättningsdeltat; ingen runtimeacceptans |
| Undo efter passerad insatsdeadline | Första demoetappen använder clear för återhämtning före start; senare utökning får bedömas separat | Nej |
| Logo/placering, återföring av avslutade spel, fler bordsspråk och fria timerprofiler | Ingår inte i första demon. Återanvänd befintliga språk en/sv, exakta mediereferenser och standardtider; pröva utökning när ett konkret behov finns. SQL-rollback och demo-credit är inte ekonomisk återföring. | Nej |

Frågepotten flyttar inte bort avtalade krav på klippkarta, sparning, behörighet,
publicering, korrekta spelregler eller exakt mediaidentitet. Status uppdateras
vid verifierad leverans; en beslutad förenkling ger inte i sig färdigprocent.
### O01 — Lås kontrakt och funktionsansvar

Beroende: K01. Kan förberedas samtidigt som J01.

- [x] Jämför main och exakt Kevin-SHA i en funktionsmatris: behåll, porta, ersätt eller radera, med konsument och testfall.
- [x] Bestäm vilka spelbeteenden som faktiskt omfattas: regler, seats, countdown, reconnect, saldo, sko, idle, tal, kort och tillgänglighet. ”Bäst” måste få observerbara acceptanskriterier.
- [x] Lås kontrakt för kommandon, händelser, lagring och presentation samt configversion/rum/paket.
- [x] Ange varje Admin-inställnings ägare, tillåtna värden, skrivmål, publiceringsgräns och verkan i aktiva/nya sessioner.
- [x] Bekräfta kontrakten med båda ägarna och placera dem i befintliga kanoniska kontrakt/docs, med ändrade beteendetester. Inga nya parallella register eller regelböcker.

Klart: Kevin och Jakob kan implementera sina sidor utan att behöva kopiera varandras runtime eller gissa schemasemantik. Bevis och granskad SHA förs till status.json.

#### O01: kontrakt, Adminurval och provspårning verifierade

Utgår från main15988f32fd572c453d2189502acbe324c4566815 och Kevin-kod
5aa7ed10df63cfa9f0a1f68e2766db1895ebd8bc. Root accepterar backenddelen i
[fryst O01-specifikation](https://github.com/Jakeminator123/scoutgaming/blob/9c669e67e40c387c84fea6d02449698d373c4c49/migrering/kevin-ks-migrering/K01/O01-svar.md) efter
root/kevin_plan-granskning och plan_review-avstämning. [Beslut6325862074](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6325862074).
Följande preciseringar gäller tillsammans med specifikationen:

- next tar R → P(lämnande spelare, sorterade) → A innan utträde/rundreset.
- Reservationskontroll sker före ren core; faktisk consume efter core på samma
  transaktion. Vägran återställer samtliga försökets effekter.
- Mottagaren applicerar endast högre planversion. Identisk senast accepterad
  version kvitteras applied utan ny applicering; lägre version ger stale.

K01 och O01 är VERIFIED. Backendöverenskommelsen på9c669e67, Adminmatrisen
nedan och 44/44 faktiskt körda isolerade kontraktsprov är granskade av root
och plan_review utan blockerande fynd. Jakobs mandat omfattar detta avgränsade
demourval. J07 har därefter verifierats separat mot riktig PostgreSQL;
J08:s writer-/publiceringsacceptans pågår och ingår inte i O01-beviset. Ingen runtimeinkoppling, DDL eller mediaimport görs här.

**Fastställt av Jakob 21 oktober: demo först, aggregatorgräns förbereds.**

Beslutet är lämnat direkt i denna chatt och [förmedlat till Kevin](https://github.com/Jakeminator123/scoutgaming/issues/312#issuecomment-6321854403).
K02 äger inga pengar eller saldo och gör inga I/O-anrop. K03 samordnar via en
explicit WalletPort; J07 binder den till mains serverägda demowallet och
Postgres-transaktioner. Reservation, konsumtion/frisläppning, ledger, kvitto,
rumsstate och audit får den avtalade atomiska gränsen i denna demoadapter.
Alla berörda main-writers ska respektera samma reservationer.

En verklig aggregator äger saldo och betalningar i en senare separat integration.
Denna migrering förbereder adaptergränsen men implementerar eller aktiverar ingen
extern betalningskoppling. En sådan adapter får inte antas vara ett direkt byte
av SQL-klient: HTTP-effekter delar inte lokal rollback. Framtida API-underlag
måste specificera stödda reservationer/bet/win/reversal, valuta, idempotens,
statuskontroll, osäkra svar och avstämning innan extern acceptans kan göras.

Kodverifierat på main15988f32 av root och underagent: server.mjs:155 väljer
storage/async-partner-api.mjs, som på rad137 blockerar extern wallet med503.
Callbacken i services/game/partner-api.mjs:97/161 hör till SQLite-spåret och
anropar HTTP före lokal transaktion; den återinförs inte. Befintlig extern-wallet-
spärr behålls tills en separat integration är verifierad. Extern konfiguration
får inte tyst falla tillbaka till demopengar. Demo betyder syntetiska pengar,
inte en ny lokal produktdatabas. Ingen drift- eller aggregatoranslutning är
verifierad av denna läsgranskning.

Skydd mot dubbla insatser och förlorade svar krävs även med extern wallet.
Kevins retrygodkännande, vidarebefordrat av Jakob, accepterar riktningen för
nekad consume: återställ startens spel-/walleteffekter, bevara accepterade val
och reservationer och ompröva först efter relevant tillståndsändring. Beständig
blocked-markering sparas enligt den valda savepointmekaniken nedan.
Databasmappning och isolerad verifiering följer J07/J09; root kopplar in Kevin
när en konkret schemamappning behöver hans hjälp. Beslutet är inte DDL-mandat.

**Verifierade skillnader som portningen måste hantera:**

| Nuvarande Kevin-beteende | Föreslagen kontraktsriktning |
| --- | --- |
| Bara act kräver exakt globalversion; andra operationer använder fas/ägarskap. Ett sent kommando kan anlända i nästa rundas samma fas. | Separera snapshotversion från insatsfönster-/rund-/turidentitet. Tillåt samtidiga insatser på egna boxar inom samma öppna fönster; avvisa försenade kommandon till annat fönster. Rättighets- och saldokontroll sker server-side i transaktionen. |
| seen/advance körs före requestId-kontrollen; en retry kan driva tidsövergång/audit och returnerar aktuell snapshot. | Spara stabilt kommandoresultat under (roomId, actorId, commandId), avvisa ändrad input och håll aktuell snapshot separat. Skilj tidsdrivna övergångar från kommandoåterspelning så att sidoeffekter får en egen beständig identitet. |
| limitsFor läses under drift; efter deadline kan nya gränser stoppa advance före både state och clear. Klientens länkspråk kan skriva bordsspråk även vid senare poll. | Admin äger gemensam configVersion, inklusive språk. Frys versionen innan insatsfönstret öppnas och genom avräkningen; lagra den över omstart. Ny publicering väntar till nästa fönster. Redan accepterade insatser ändras/rensas inte som bieffekt. En spelares länk eller login får aldrig skriva bordets konfiguration. |
| onPlan anropas före databasens COMMIT; rollback tar inte tillbaka startat workerarbete. | Lagra presentationshändelsen atomiskt med kommandot och leverera först efter commit med återläsbar sekvens och dubblettskydd. |
| Läppatchar söker inom ±48 tidsindex vid 24 fps och har slutrute-/VILA-reservval. Gamla indexnycklar rensas inte vid patchbyte. | Bevara exakt dealer/källbildruta/ljud/bank och planversion. Andra bildrutor kräver verifierad ekvivalens och separat ljudtidskontrakt. Rensa ersatta index och spärra tysta/äldre versioner; saknad giltig patch ger kropp/ljud utan munlager. Tidsfönstret är inte bevis för synk. |

Kodreferenser: K server/shared-table.mjs:207–232,329–346; public/shared-table.js:70–72;
public/lip-layer.js:53–60,74–90,143–161; server/rorlig-lipsync.mjs:260–268.
Kodriskerna är läsverifierade, inte observerade i en ny körning. SQLite-skrivlåset
gäller databasfilen även mellan processer; dess serialisering får inte antas gälla
automatiskt när lagringen flyttas till Postgres.

**Mains skrivvägar — läsverifierad bas på 15988f32:**

G är befintligt advisory-lås 1129467984, P spelarens radlås, S Studio-scope.
A nedan är ett föreslaget separat spel-auditlås; ingen DDL är utförd.

| Skrivväg | Befintlig transaktion/auktoritet | Samordning före J07-port |
| --- | --- | --- |
| /api/table → services/game/postgres-native-table.mjs:14 | P; blackjackstate per spelare, saldo, ledger och senaste presentationskvitto i samma commit. | Bevara gemensamt spelarlås; besluta beständig återspelningshorisont. |
| /api/roulette/table → services/game/games/roulette/storage.mjs:44 | P; roulette-state/ledger och senaste 20 kvitton. Publiceringskontroll använder samma klient men tar inget publiceringslås. | Rouletteägaren måste samordna reserveringar och versionsgräns. |
| /api/deposit och /api/currency → services/game/server.mjs:265 | G → P → ledger; ingen kommandoidempotens. Valutaspärren läser bara gamla blackjackstate. | Valuta och tillgängligt saldo måste ta hänsyn till samtliga aktiva bord/insatsreservationer. |
| Partner-table/demo-credit/Studio-credit → services/game/storage/async-partner-api.mjs:95 | G → P. Partner-replay jämför spelare/op, inte hela input; Studio använder kortlivad nonce. Externa wallets är spärrade. | Beständigt kommandoresultat och full inputfingerprint; inga kopierade externa wallets. |
| Admin konto/status/lösenord och relaterade sessioner → packages/storage/server/player-administration.mjs:23 | G → P → konto/session/adminaudit. Kontostängning kontrollerar gamla blackjackstate. | Admin/auth måste känna till delade händer, reserveringar och avräkning. |
| Admin rum/publicering → apps/studio/lib/studio-native-runtime.mjs:132 | G → S → operatörslås; Studio-/operatörsaudit, ingen spelhashkedja. | J08/publiceringsägaren samordnar configVersion; Studio-audit ersätter inte spel-audit. |

Fasadens AsyncLocalStorage delar endast arbete inom samma pool/transaktionskontext.
Råa gamePool-transaktioner deltar inte automatiskt: injicera den redan låsta SQL-klienten
i alla berörda adapters. Se packages/storage/server/postgres-store.mjs:70–107.
Återanvänd inte G som auditlås efter P: befintligt G → P skulle då få motsatt
låsordning. Om G behövs i ett flöde tas det först, följt av deklarerade berörda rum
i sorterad ordning → sorterade spelare → separat A. Ingen senare låsutvidgning.
Studio-/operatörslås ska inte hämtas efter spelar-/auditlås på en ny anslutning.
Den slutliga ordningen och publiceringskontrollen måste stämmas av med alla skrivägare.

Orkestratorns 9/9 befintliga isolerade prov, 0 skip, verifierar mockade kontrakt för
G → S, nekad låseskalering, gemensam klient, rollback och wallet/state/ledger/kvitto.
Kommando och logg finns i status.json. Detta är inte ett faktiskt Postgres-raceprov
och godkänner inte den föreslagna flerbordsordningen. Mains ledger är inte en
spelhashkedja. Kevins fortsatta förslag avgränsar den nya kedjan till spelens
egna händelser; övriga walletwriters behåller mains ledger/audit.

Tidigare rättningsfynd och deras beslut finns i status.json[O01/K02/K03] och
[GitHub-tråden](https://github.com/Jakeminator123/scoutgaming/issues/312).
Aktuellt bevis: plan_review körde13/13 K02,30/30 K03 och1/1 kompletterande
språkprov på blobhashverifierade källor; root läste loggar och språkprovet.
52/52 och tidigare hookkörningar på Kevins sida är fortsatt rapporterade.
[Provmappning och kommandon](kevin-ks-migrering/AKTIVITETER.md#o01--faktiskt-körda-isolerade-kontraktsprov-21-oktober).

**Adminfält — fastställd minimiomfattning för O01/J08:**

Urvalet nedan gäller första demon inom Jakobs mandat. Kodunderlag: main
15988f32, Kevin 5aa7ed10, K03 b8e1c957 och O01-spec 9c669e67. **Befintlig**
betyder läst writer/validator på main. **Mål J08/J07** betyder beställd
koppling, inte implementerad Adminfunktion eller verifierad PostgreSQL-adapter.
Spelaren får inte skriva bordskonfiguration via join, poll, språkval eller URL.

| Fält och ägare | Tillåtet värde / validator | Writer | Publiceringsgräns | Konsument |
| --- | --- | --- | --- | --- |
| Rumsnamn, företag, komposition och spel — N1 | name 1–100 tecken utan kontrolltecken; registrerat operatorId/presentationLaneId. Kevin-modulen omfattar blackjack; befintlig roulette behåller sin väg. | Befintlig presentation-room-api med idempotencyKey och projekt-/admin-/paket-CAS | Atomisk rum/paket-publicering; autentiserad ägar- och mediebindning kontrolleras igen. Mål J08/J07 binder spelconfig till samma publicerade rum/paket. | Lobby, roomPlayPath, mains game-entry-selector, K03-rumsadapter |
| Insatsprofil — N1 | limitPreset = casual/prive/high, standard prive; hela limits/chips/refill-paketet i tabellen nedan. Inga fria belopp eller rå JSON i första demon. | Mål J08: validerat rumsutkast och publicering genom befintlig rum/paket-writer; J07 ConfigPort.latest/frozen | Ny configVersion; samma profil fryses för ett fönster och dess runda. Publicering ändrar inte lagda insatser. | K03 bet/ready/refill, K02 step med limits; refill går via mains globala demo-wallet/ledger |
| Bordsspråk — N1 | language = en/sv. Valet kräver motsvarande exakta tal-/mediabindning i valt paket; saknat stöd nekas vid publicering, ingen tyst språkfallback. Privat UI-lokalisering är separat. | Mål J08/J07: samma configpublicering som insatsprofil | Språk binds till configVersion/windowId och gäller även återanslutning/omstart. Join/poll ändrar inget. | K03 presentation.plan/outbox.language; K04 väljer exakt inspelning/tal för publicerad dealer |
| Rundtider — N1, standardprofil i första demon | betMs=20000 och actionMs=15000, befintliga Kevin-standardvärden. Visas i Admin; fria timerfält ingår inte i första demon. | Mål J08/J07: värdena sparas i samma publicerade configVersion | Servern lagrar deadlines; klientnedräkning får inte styra start eller ändra ett öppet fönster. | K03 första insats, action/insurance-deadline och självständig scheduler |
| Rummets bord, bakgrund, dealer och färg — N1; partner endast enligt befintlig grant | roomOverrides[roomId].table/background/dealer från publicerade tillåtelselistor; color enligt /^#[a-f0-9]{6}$/ och tillåten palett. Rätt rum/företag/dealer krävs. | Befintlig partner-branding-api save-draft/review/publish med draft-/paket-CAS och reviewToken | RoomOverrides för rätt rum; delad mall är inte rumswrite. Mål J08/K04 binder det valda paketet till configVersion så pågående runda behåller sitt material. | Mains paketresolver, därefter K04:s presentation |
| Dealer, klipp, grundloop och talunderlag — N1 | Registrerade dealer-/media-ID:n och exakt hash. Idle: validateRegisteredIdlePolicies/validateIdlePolicy, samma dealers baseline. Talprofil: normalizeDealerSpeechProfile + validateDealerSpeechReference; state preparation/enabled, egen röst och egen video/hash/offset. Enabled är inte i sig drift- eller kvalitetsgodkännande. | Befintlig saveProject med expectedRevision och paketpublicering; ingen ny person-/mediekatalog | Exakt paket/playbackrevision fryses. Mål K04/K05 mappar Kevins take/frame/audio till godkänd identitet; ingen återimport av bortvald V1. | Gemensam presentation, lugn idle, K04-tal/kort/lipsync; K02 förblir utan media |
| Lipsync-drift — N1, miljöscopad | Befintligt mode off/saving/warm, validerad profileId; warm durationSeconds 1800/7200/86400; expectedRevision och commandId. Inga råa worker-URL:er eller hemligheter som rumsfält. | Befintlig moving-drift-admin/controller; miljögrind krävs | Egen driftrevision, inte configVersion. Ändrar inte spelutfall eller publicerad medieidentitet. Ingen ny providerstart/GPU-körning beställs här. | Tal-/moving-kopplingen efter befintlig sessionsverifiering; utan worker gäller avtalade inspelade steg/idle |
| Djuplänk till rum/spel/dealer — härledd, skrivskyddad | Befintlig roomPlayPath och serverkontrollerat rum/paket/spel/dealer; query är aldrig konfigurationsauktoritet | Ingen ny writer | Länken pekar på publicerat rum; launch revaliderar session, ägare och paket | Lobby och mains launch/game-entry-selector |
| Shoe-proof/auditrapport — N1-läsning | commitment för öppen sko, full proof först efter stängning; råtext/nyckelordning bevaras och global auditsekvens verifieras | K03 AuditPort skriver i speltransaktionen; mål J08 visar läsvy. Befintlig skostatistik är inte detta bevis. | Ingen Admininställning för RNG, kort eller utfall; config-/rund-/skoreferens följer beviset | K02 verifyShoe och global verifyChain; ingen certifierings- eller lipsyncacceptans påstås |

Profilerna är exakt Kevins befintliga LIMIT_PRESETS, inte mains tidigare
hårdkodade sololimiter. Beloppen är demoenheter. refill är beloppet för ett
uttryckligt idempotent refill-kommando; join skapar ingen lokal startplånbok.

| limitPreset | min / max / sideMax | chips | refill |
| --- | --- | --- | --- |
| casual | 1 / 500 / 50 | 1, 5, 10, 25, 50, 100 | 500 |
| prive (standard) | 5 / 2000 / 200 | 5, 10, 25, 50, 100, 500 | 1000 |
| high | 100 / 25000 / 1000 | 100, 500, 1000, 5000, 10000, 25000 | 50000 |

**Gemensamt målkontrakt för publicering:** Spara skapar endast utkast.
Mål J08: de befintliga revisions- och behörighetskontrollerna omfattar alla nya
fält; publicering gör paketbindningen och en oföränderlig configVersion
tillgängliga atomiskt. J07:s ConfigPort läser den publicerade versionen på
den redan låsta SQL-klienten. Ett nytt fönster binder den senaste versionen
och behåller den genom avräkning och omstart. Endast tomt bord utan main
och deadline får genom ett uttryckligt serversteg skapa nytt windowId med
ny version; snapshot/replay gör aldrig detta. Ogiltiga fält, fel ägare och
inaktuell revision nekas utan delvis publicering. Befintlig paketrevision
ersätter inte denna fönsterbindning.

Presentationens leadMs/cardMs är K04:s serverägda planering, inte fria
operatörsfält. K03-fixturens 700/500 ms är testdata, inte accepterad timing för
ett visst klipp. K04 binder verklig planering till exakt publicerat material;
regeln om kropp/ljud utan giltig munpatch gäller fortsatt.

Läsbevis för matrisen:

- main: packages/presentation/contracts/presentation-room.mjs:5 och apps/studio/lib/presentation-room-api.mjs:286–320 (rum, CAS, atomisk publicering); partner-branding-api.mjs:164–215,259–291 (allowlist, roomOverrides, review/publicering).
- main: packages/presentation/server/saved-game-policy.mjs:145–173 (projektwriter); contracts/dealer-speech-profile.mjs:8–42,82–87 och runtime/registered-idle-policy.mjs:22–35 (exakt profil/idle); contracts/frozen-dealer-playback.mjs:51–95 (paketets mediebindningar). Sökvägarna under contracts/runtime avser packages/presentation/.
- main: packages/presentation/contracts/studio-speech.mjs:39 (en/sv); contracts/moving-drift.mjs:3–22 och apps/studio/lib/moving-drift-admin.mjs:42–49 (drift); services/game/storage/async-partner-api.mjs:198–200 (demo-credit, inte spelåterföring).
- Kevin 5aa7ed10: kevin/croupier-scoutgg/server/studio-tables.mjs:8–14,38–43 (profiler; standardvalet prive fastställs här); server/shared-table.mjs:42 (20s/15s). K03 b8e1c957: services/game/games/blackjack/table/ports.mjs:30 och coordinator.mjs:101–135,297–343 (config, språk, refill, limits, deadlines).
- Spårbara kontraktsprov:13/13 K02,30/30 K03 och1/1 språk, inga skips; se provmappningen ovan. Dessa verifierar inte framtida Adminvalidatorer, HTTP-auth, media, PostgreSQL eller K06:s hela spara→publicera→spel-flöde.

**Gemensamma gränser och kvarvarande beslut:**

- Mains auth bestämmer actor, operatör och tillåtet rum. Kommandot bär roomId,
  commandId och relevant fönster-/rund-/turidentitet enligt accepterad matris.
  configVersion binds server-side till fönstret; global version är snapshotversion.
  Replay och state/tick följer det delaccepterade kontraktet ovan.
- Behåll mains globala saldo. Rum, saldo, avräkning, kvitto, idempotens och audit
  committas atomiskt. Mains skrivvägar ovan kräver separat auditlås och G först
  där G behövs; slutlig ordning stäms av med berörda ägare. J07 verifierar
  implementationen. Dolda kort och utfall förblir serverägda.
- Rumsstate inklusive shoe proof, auditpayload och separat proof bevaras som text.
  Nyckelordning/numeriska typer kräver kompatibilitetsprov; rowid ersätts uttryckligen.
  Studio-audit ersätter inte spelhashkedjan.
- Bevara deterministisk lugn väntekedja, klippgräns vid hit/stand, tal/idle och
  fortsatt kropp/ljud vid sena eller saknade patchar. Utan worker används befintliga
  godkända inspelade videosteg; väntekedjan filtreras fortfarande till calm/andas.
  vilaMap byter patchkarta, inte kroppens uppspelning. Exakt VILA-ekvivalens och
  kompatibel worker krävs innan sådana reservval kan accepteras.
- Nödvändiga kontraktsprov: parallella insatser; sent kommando i ny runda;
  retry över deadline med stabilt resultat och inga dubbla effekter; rollback utan
  presentation; publicering med liggande insatser och omstart; språk vid join/poll;
  omordnad patchavkodning, ersatta index, tysta rutor, sen version och workerbortfall.
  Riktade isolerade prov räcker för kontraktsarbete; visuell läppsynk kräver separat
  acceptans och inga nya GPU-prov är beställda här.

O01 är verifierad som kontraktsaktivitet efter oberoende slutreview av
Adminurvalet och provspårningen. Detta godkänner inte framtida writers eller
full K02/K03-integration. Faktiska PG-/GPU-/produktionsprov följer egna
aktiviteter; media är fortsatt kandidater, inte importgodkända.

### O02 — Oberoende samprov

Beroende: K07 och J10.

- [ ] Frys en integrerad kandidat och verifiera schema, miljö, webb, motor och media separat.
- [ ] Kör Admin spara → publicera → lobby → auktoriserad launch → spel → återanslutning → omstart → återläsning.
- [ ] Verifiera negativa fall: fel rum/ägare/roll, inaktuellt paket, dubbelkommandon, samtidiga spelare, avbruten presentation och felaktiga media-ID.
- [ ] Visa att borttagna ytor inte kan starta en alternativ produkt, och att testfixturer aldrig använder riktiga användardata.
- [ ] Granskare redovisar observerat resultat, testmiljö och kvarvarande brister; tidigare agentkvitton tillskrivs sina författare.

Klart: inga blockerande fynd; verkliga driftprov redovisas åtskilda från automatiska tester.

### O03 — Integration och leverans

Beroende: O02.

- [ ] Kontrollera aktuell main, PR-ägare, källrepo, full head, konflikter, obligatorisk CI och säkerhetsstatus.
- [ ] Följ AGENTS.md:s ägarregel: Kevin-ägd PR kräver Jakobs uttryckliga godkännande för just PR och oförändrad head. Citerade Slack-meddelanden är inte det godkännandet.
- [ ] Kör schemaändringar i godkänd ordning. Krävd Neon-readiness måste passera före merge; expansion/tolerant kod/avveckling får delas i flera PR:er där det behövs.
- [ ] Godkänd release ska ha verifierad Vercel-/Render-SHA, schema, vanlig inloggning, Admin-sparning, launch och relevant spelfunktion.
- [ ] Dokumentera återställning som fungerar med faktiskt migrerat schema, uppdatera befintlig handoff och stäng egna claims.

Klart: den integrerade produkten är faktiskt levererad och verifierad. Ingen förhandsmarkering av 100% för grön CI eller färdig plan.

## Radera med ett konkret slutdatum

I varje ändring ska agenten ange **vad som ersätts och vad som därför raderas**. Följ konsumenterna hela vägen: route → komponent → tjänst → adapter → data → build/env/test/docs. Ett gammalt namn räcker inte som raderingsbevis; en pensionerad implementation behöver inte behållas för sitt namn eller sin historik.

- **Kod:** ersatt eller utan aktiva konsumenter tas bort tillsammans med registreringar, tillhörande ensamma tester och instruktioner. Git är återställningen för versionerad kod.
- **Oklarhet:** gör en avgränsad konsumentkontroll i den aktuella aktiviteten. Notera konkret återstående fråga och ansvarig; bygg inte en permanent extra kompatibilitetsväg för att slippa avgöra.
- **Databas:** ta först bort läsare/skrivare och uppdatera schema/readiness. Prova migrering och återställning isolerat, därefter separat godkänd produktionsåtgärd. Noll rader är inte ett tillräckligt bevis för att tabellen kan släppas.
- **Media:** koppla exakta ID/hashar till aktiva och historiska paket. Oanvända Kevin-filer ska inte importeras. Historiskt refererade main-media raderas inte genom namnmatchning.
- **Ignorerat:** inventera bara utpekade metadata och konsumenter i exempelvis lab/data och open-claw/lab/data. Respektera .ignore; läs inte hemligheter, binärmassor eller det privata historiska dokumentarkivet. Ingen rg --no-ignore. Återställningsmaterial är inte en alternativ produktkälla.
- **Tester/regler:** avveckla gamla layoutlås samtidigt med ersättningen. Behåll säkerhets-, transaktions- och spelregler. Referenser till gamla repon får inte få agenten att återställa pensionerad kod.

Aktiva gemensamma tjänster flyttas eller får neutralt namn endast när det underlättar ansvarsfördelningen. En filflytt utan bättre flöde eller borttagna alternativ räknas inte som slutförd aktivitet.

## Arbetsordning nu

1. Läs status, denna revisions nuläge och aktuell handoff. Frys faktisk main och käll-SHA; granska kvarvarande funktionsgap, inte antal omergade commits.
2. Ta en avgränsad leverans ur prioriteringstabellen. Återanvänd main-kontrakt och ange observerbart godkänt resultat samt vad som faktiskt ersätts.
3. Separera kodport, publicering/lagring, faktisk media, Postgres/processprov och driftbevis. Gör inga produktions- eller GPU-åtgärder med denna dokumentrevision som mandat.
4. Uppdatera samma aktivitet i status.json efter granskad acceptans och generera STATUS.md. En mergad del-PR eller planfil ger inga automatiska poäng.
5. Följ befintlig ägarregel vid PR-hantering. #315/#323/#333 lämnas till ägargranskning; de är inte en färdig mergekö.

Tidigare resursplan, pausbeslut och uppskattning på 7–12 arbetsdagar från 21–22 oktober är historiska. Ny tids-/kostnadsbedömning kräver valt mediaurval, aktuell testmiljö och uppmätt återstående arbete; ingen generell tidsvinst härleds ur 45 %-siffran.
