# GitHub-historik: verifierad backup och konkret städunderlag

31 oktober 2026. Beställd incidentutredning om Git-storlek, dokumentrester och bevarande. Detta är ett fryst bevisunderlag, inte aktuell produktstatus eller mandat att radera historik. AGENT 0 kan leda fortsatt produktarbete. Ingen äger den gemensamma checkouten exklusivt. Den konkreta övergången och dess nackdelar står i [planen för en liten produktrepo](2026-10-31-clean-repository-plan.md).

## Slutsats

Den stora lokala, säkra vinsten är redan utförd: **8,38 GiB frigjort**, med alla tidigare 61 806 lokala Git-objekt bevarade. Den granskade main-snapshoten är **84,94 MiB spårade filer**. Den fullständiga GitHub-spegelns packfiler är **4,11 GiB**. Det är olika mått: arbetsfiler, lokal objektlagring och hela fjärrhistoriken inklusive PR-referenser. Backup och jämförelseartefakter tar separat diskplats; den tidigare frigörelsen är inte nettot efter att dessa kopior skapats.

Att merga ett par PR:er, radera en branch eller ta bort Kevin/Emil som kollaboratör återställer inte automatiskt ett litet repo. En merge behåller historiken; identiska objekt delas mellan brancher; en raderad fil finns kvar i tidigare commits. Kollaboratörsåtkomst ändrar inte lagrade objekt.

## Fryst underlag och backup

Backup: `C:/Users/jakob/dev/backups/scoutgaming/2026-10-31-history-audit/`.

| Del | Bevis |
| --- | --- |
| main | `bbe4c7e503c5557aaea71534185c9b79d70f79bd` |
| preview | `6a3f976e4428627b135664ba7d13ae24593567c4` |
| Ursprunglig GitHub-spegel | 30 brancher, 5 taggar, 701 PR-referenser; samtliga 736 annonserade referenser matchar SHA före hämtningen |
| Fullständighet | Ingen shallow-klon, inget partial-clone-filter, inga alternates; full `git fsck` passerade |
| Nya agentens PR #717 | Head `6edfe27bc68d8c1f875bbf7fa9051fc256005cb6` separat säkrad under `refs/backup/observed-1031/`; dess filträd ingår i kandidatskyddet |
| Bordmall | `local-test/bordmall`, head `dee1c5aa77b813cf1b3f5948bc084de15e11e2b1`; ren och oförändrad |
| Lounge | `local-test/lounge`, head `45a064b786fd018d9e8243736f65355bdeb612ea`; 120 ändrade/nya filer, 12 435 333 byte, kopierade och SHA-256-verifierade |
| Testernas driftkontroll | Samma heads; inga av de 120 kopierade arbetsfilerna hade ändrats vid slutkontrollen |
| Avvecklade hjälptester | Båda inkrementella bundles verifierade mot fullbackuppens bascommits |

Spegelns ursprungliga refsnapshot togs 01:05 svensk tid och full hämtning/fsck var klar 01:42. Den nya PR-headen tillkom därefter i backupen. GitHubs tillfälliga syntetiska merge-ref för PR #717 ingår inte i originalsnapshoten; själva författarens head och arbetsinnehåll är säkrat. Senare commits eller opushat arbete på kollegornas datorer omfattas inte.

Backupen ligger på samma C:-disk, inte offsite. Den täcker Git och de namngivna lokala testerna, inte Neon, Blob, driftens miljövärden, fullständiga issue-/PR-diskussioner eller Actions-/releasebilagor. Nio historiska `.gitattributes`-versioner kontrollerades utan LFS-regler. Genererade `node_modules` och `design-preview-build` är undantagna. Push-adressen i backupen är avstängd.

Bevis: `backup-verification.json`, `final-integrity.json`, `mirror-status.json`, `tests/*/manifest.json`, `analysis/independent-verification.json`. Återställningsbeskrivning finns i backupens README.

## Vad består historiken av?

Efter tillägg av den nya agentens head omfattar analysen 70 047 Git-objekt, 5 003 commits och 36 105 unika historiska filobjekt. Tabellen nedan är en disjunkt uppdelning av filobjekten; samma objekt räknas inte två gånger.

| Historiska filobjekt | Okomprimerade byte | Representation i nuvarande lokala pack/objektlager |
| --- | ---: | ---: |
| Nåbara från mains historik | 1 667 174 925 | 826 587 841 |
| Övriga branchers historik, utanför main | 1 759 699 347 | 1 607 769 367 |
| Endast PR-/tagg-/backuphistorik, utanför alla ursprungliga branchheads | 4 023 066 293 | 1 970 988 993 |

Packrepresentationen är inte ett löfte om frigjorda byte efter radering: delta-komprimering, ompackning, dolda referenser och GitHubs lagring påverkar resultatet. GitHubs tidigare API-fält `size` var 2 381 293 KiB, ungefär 2,27 GiB; det var inte samma mätning som den nu hämtade fulla spegeln.

Historiken innehåller många tidigare media-/3D-versioner, äldre parallella produktträd och PR-heads vars brancher redan är borta. Gamla Blender-/GLB-filer och andra medier står för de stora kandidaterna. Den borttagna `docs/JOHN-HANDOFF.md` har 1 614 olika blobversioner över alla referenser, totalt 252 395 169 råa byte. I mains linje ändrades filen i 1 457 commits mellan 8 september och 27 oktober. Det visar versions- och handoff-tillväxt, inte en korrupt Git-databas. Författarfälten innehåller både personer och agentkonton och räcker inte för att lägga ansvaret på en person.

## Exakt kandidatlista

**`analysis/candidate-files.csv` innehåller 8 003 exakta blob-SHA:n**, kategorier, byte, samtliga historiska sökvägar samt om objektet finns i mains historik eller hålls kvar av PR-referenser. `candidate-blob-ids.txt` är den maskinläsbara ID-listan.

Sökvägarna här avser backupmappen ovan. Rålistan ligger utanför Git: 1 356 287 byte, SHA-256 `85bd7c55f3ce63494d1c155dedd371bdae29fe078e2d85fdad9bae3f56420fc4`. Den oberoende verifieringen har SHA-256 `de612de7d2111f36163d4c1e61f53a0f7a73b8d3fa05c341646ca9d17fe5293a`. De stora maskinlistorna och backupobjekten committas inte som ny dokumentlast.

| Kandidater som saknas i skyddade nuvarande filträd | Antal | Råa byte | Nuvarande lagringsrepresentation |
| --- | ---: | ---: | ---: |
| Äldre media/modeller, inklusive Blender | 3 480 | 4 131 435 159 | 2 018 450 770 |
| Äldre dokumentversioner | 4 523 | 373 453 013 | 5 370 958 |
| Totalt | 8 003 | 4 504 888 172 | 2 023 821 728 |

**Säkerhetsbevisets räckvidd:** inga kandidat-ID:n förekommer i de 71 skyddade refarnas filträd eller de sparade lokala arbetsfilerna. Träd-ID:n verifierades oberoende med Gits egen `ls-tree`/`rev-parse`. Alla ursprungliga branchheads, taggar, de 33 stängda omergade PR-headarna, två tester och den nya PR #717-headen ingår. Privat arkivmaterial, kodhistorik och historiska versioner på Lounges ändrade sökvägar har undantagits. Blandade kod-/mediasökvägar gallras inte.

Detta bevisar att **dagens skyddade filer kan bevaras**, inte att en historikomskrivning redan är genomförd eller att commit-ID:n och externa historiska hänvisningar förblir giltiga. Listan gäller blobversioner: radera inte hela sökvägar som också kan ha en annan, fortfarande använd version. Aktiva Neon-/Blob-bindningar, lagringslivscykler och produktacceptans har inte granskats för någon produktionsradering.

Ett avgörande resultat är att **samtliga 3 480 mediekandidater ligger utanför mains historik**. Mains äldre medieobjekt hålls samtidigt kvar av andra skyddade branchers nuvarande träd. Med kravet att bevara deras innehåll kan de inte bara tas bort överallt. Dokumentkandidater i mains historik uppgår till 340 920 834 råa byte men bara 5 219 001 byte nuvarande packrepresentation.

**8 000 av 8 003 kandidater hålls dessutom kvar av PR-referenser**, totalt 4 502 166 118 råa byte. Vanlig branchradering räcker därför inte för att få bort dem från det befintliga GitHub-repot. GitHub beskriver PR-referenser som skrivskyddade; vanlig historikstädning är inte samma supportärende som att radera exponerade hemligheter. [GitHubs dokumentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

## Varför inte bara radera kollegornas brancher?

Detta är en läsande kontrafaktisk beräkning, **inte en raderingslista**. Ingen sådan branch har ändrats.

| Om bara denna branchref försvann | Filobjektsbyte som då inte hålls av någon annan analyserad ref | Tolkning |
| --- | ---: | --- |
| emil | 0 | Hela historiken finns redan kvar via andra refar, inklusive main |
| kevin | 434 325 | Nästan hela den stora historiken delas eller hålls kvar av andra refar |
| kevin-staging | 191 689 996 | Mer egen data, men också 294 commits utanför main; kollegans pågående arbete får inte kastas |
| john | 302 843 | En commit utanför main; ingen stor lagringsvinst |

Siffrorna är råa objektbyte, inte garanterad omedelbar besparing på GitHub. Hela branchmerge kan dessutom föra tillbaka gamla medieträd till dagens produkt. Välj och granska den kod som faktiskt ska överföras tillsammans med ägaren.

## Två uppmätta lokala alternativ

| Granskningsartefakt | Storlek | Förändring mot fullspegelns packfiler | Vad som bevaras |
| --- | ---: | ---: | --- |
| `product-and-tests-history.bundle` | 831 091 649 byte, 792,59 MiB | Cirka 81 % mindre | Full ancestry och befintliga commit-ID:n för main, preview och båda testheads |
| `proposal-main-snapshot.git` | 68 090 037 byte i packmappen, 64,94 MiB | Cirka 98,5 % mindre | Exakt mains nuvarande filträd i en ny rotcommit |

Bundle-kontrollen verifierade full historik utan externa prerequisites. Engångssnapshotens träd är exakt `7e1860abf668f4ca8bb4f9e50a26f224cf90f170`, samma som frysta main; full fsck passerade. Inga produktfiler ändrades för jämförelsen. Snapshotens commit-ID är nytt, och den innehåller inte kollegornas andra brancher eller testernas arbetsfiler.

**Valet efter jämförelsen:** Jakob vill utvärdera alternativet på cirka 65 MiB. [Övergångsplanen](2026-10-31-clean-repository-plan.md) beskriver hur befintliga repon och tester bevaras, vad som försvinner ur den nya historiken och vilka integrationer som måste provas. Alternativet på 793 MiB finns kvar om gamla commit-ID:n ska vara nåbara även i den nya produktrepon. Inget av alternativen har införts på GitHub.

Inget av alternativen är ännu en färdig GitHub-/driftövergång. Repository-ID, GitGuardian, Vercel/Render, branchskydd, CI, historiska referenser och andra agenters kloner behöver samordnas. De två lokala testerna delar fortfarande originalrepots Git-lager; deras koppling måste bevaras eller exporteras innan någon framtida ersättning av det lagret. Inga kollegor behöver portas för att kunna separera produktleveransen från äldre experiment.

## Dokumentation och att stoppa ny tillväxt

Dokument-PR [#716](https://github.com/Jakeminator123/scoutgaming/pull/716) är mergad efter exakt-head CI. Den förbrukade miljöinventeringen togs bort och kvarvarande sakuppgifter införlivades i befintliga guider. Markdown-filer vid snapshoten, före denna rapportleverans: **92, totalt 704 826 byte**. Inga daterade Markdown-inventeringar fanns då kvar under docs; inga brutna relativa länkar hittades utanför kodexempel. Detta är en strukturkontroll, inte sakgranskning av alla planer.

Repoets filgränser finns redan, men CI på main/preview och PR:er stoppar inte att stora objekt först pushas till andra brancher. Följande är kvarstående förslag, inte införda ändringar:

1. Gemensam kontroll av alla nya Git-objekt före push, även filer som lagts till och raderats mellan två commits; media/modelloriginal utanför Git med avsedda publiceringskontrakt.
2. Storleksrapport i PR och regelbunden, rapporterande kontroll av förbrukade dokument. Ingen blind radering enbart efter datum.
3. Lokalt säkert ompackningsunderhåll och städning av verifierat förbrukade egna arbetsytor. Ingen automatisk historik-/branchradering som kan kasta andras arbete.

GitGuardian var efter den tidigare kontrollen på 0 öppna och 25 ignorerade incidenter; de två aktuella testuppgifterna var klassade som test credentials. Den gamla historiska skanningen `too_large` är inte därmed omkörd eller löst. En mindre aktiv produktrepo är inte ett bevis på att originalrepots historiska skanning blivit komplett.

## Utförda respektive kvarstående åtgärder

- Utfört: tidigare lokal rensning, två bevarade testarbetsytor, dokument-PR, full fristående Git-backup, testkopior, exakt inventering, oberoende trädkontroll och två uppmätta jämförelseartefakter.
- Oförändrat i detta historikuppdrag: fjärrbrancher, kollaboratörsåtkomst, main-historik, produktionsmedia och molnkonfiguration.
- Återstår endast om en faktisk GitHub-flytt eller historikomskrivning beställs: vald övergång, integrationer/ägarsamordning och verifierad publicering. Ingen påminnelse eller återkommande automatisk radering har skapats.

Metodbegränsning: `git-filter-repo` användes inte och ingen omskrivning av befintlig historik provkördes. Analysen och de fristående jämförelserna genomfördes med Git och egna avgränsade skript.

## Avslut och Neon-kontroll — 31 oktober, cirka 02:25–02:32 svensk tid

**Avslutsbedömning:** den stora lokala Git-städningen och dokumentleveransen är klara. Ingen akut Neon-radering motiveras av den uppmätta storleken. GitHubs äldre historik och dess `too_large`-skanning finns fortfarande kvar; en ny produktrepo är ett separat, förberett beslut, inte en genomförd storleksminskning på GitHub. AGENT TVÅ håller ihop OpenClaw-leveransen. Denna kontroll ändrade inga databaser, grenar, roller, TTL-värden eller produktionsinställningar.

Neon lästes via pluginens projekt-/grenmetadata, `inspect_database` och aggregerade SQL-frågor. Inga konton, chatttexter, transaktioner eller hemlighetsvärden exporterades. Kodgranskningen av rutinerna gäller main `eb41edc03378789a371be8f22965e7ca06f3ddcd`; den är inte ett prov av vilken rutin som körts i produktionen. Säkra mätunderlag finns lokalt i `.cache/neon-closeout-1031/` och är inte en databasbackup.

| Mätning | Produktion | Preview |
| --- | ---: | ---: |
| Aktiv appdatabas | `croupier_game`: 24 723 456 byte (23,58 MiB) | `croupier_staging`: 21 708 800 byte (20,70 MiB) |
| Dokumenthistorik | 356 revisioner; tabell inklusive TOAST 6 040 KiB | 116 revisioner; tabell inklusive TOAST 920 KiB |
| Nya dokumentrevisioner 30 oktober, UTC-dygn | 3 | 7 |
| Publicerade paketrevisioner | 75 | 62 |
| Spelaudit / outbox / receipts / ticks, antal rader | 346 / 86 / 109 / 60 | 3 205 / 828 / 1 158 / 356 |
| Neon-grenar inklusive main | 7 | 3 |
| Avgränsad autovacuum-kontroll | 74 tabeller, inga över diagnostikens tröskel | 75 tabeller, inga över diagnostikens tröskel |

Detta är storleks- och räkningsögonblicksbilder, inte en lång mätserie eller en full bloat-/belastningsanalys. Neon-grenars logiska storlekar ska inte summeras som oberoende fysiska kopior: grenarna delar data tills de divergerar.

### Vad begränsas redan, och vad kan växa?

| Rutin | Verifierat beteende och slutsats |
| --- | --- |
| Chattminne | `services/game/storage/async-player-chat-memory.mjs`: högst 30 historikposter/8 000 tecken per profil; requests gallras efter ett dygn och inaktiva profiler efter 30 dagar. Prune anropas vid uppstart och användning, inte av en separat schemalagd städare. Inga requests äldre än ett dygn eller profiler inaktiva över 30 dagar fanns vid kontrollen. |
| Probe-data | `async-player-probe-store.mjs`: fakta följer expiry, källor/rundor 30 dagar, försök 31 dagar och sessionsnärvaro ett dygn. Anropad gallring; inga probe-sessioner över ett dygn vid läsningen. |
| Spelarinloggning | `async-player-auth.mjs`: utgångna sessioner tas bort vid ny inloggning; logout tar den egna sessionen. Tre utgångna poster i produktion och 94 i preview låg kvar. Expiry hindrar användning, men ålder ensam startar ingen fysisk radering. Den lilla mängden motiverar ingen separat cron nu. |
| Dokumentrevisioner och Studio-audit | `packages/studio-registry/server/repository.mjs` sparar föregående dokument och en auditrad vid sparning. Ingen generell automatisk SQL-gallring hittades. Historiken är idag liten men kan växa med sparningstakten. |
| Publicerade paket | Gamla revisioner kan bära låsta rums konfiguration och mediereferenser. Vanlig papperskorg är inte historikgallring. Avveckling kräver konsumentkontroll, inte en åldersgräns ensam. |
| Spelaudit, outbox, ticks och receipts | `postgres-store.mjs` lägger till poster; outbox kvitteras med status, den raderas inte där. Receipts/ticks skyddar mot dubbel hantering och audit läses av spelresultat och revisionskedjan. Ingen generell gallring hittades i granskade kod-/SQL-rutiner; radera inte dessa med en blind TTL. |
| Lokal retention-policy | `tools/retention-policy.json` och `retention-archive.mjs` gäller lokala history-/observationsfiler. **De begränsar inte Neons tabeller.** Autovacuum återanvänder utrymme efter ändrade/raderade rader; det bestämmer inte vilka historiska affärsrader som ska sparas. |

Ingen `pg_cron`-extension eller matchande gallringsfunktion för dokument-/spelhistoriken hittades i de två aktiva databaserna. Externa schemaläggare har inte fullständigt inventerats. Innan väsentligt större trafik behövs ett avgränsat bevarandekontrakt för revisioner/loggar med återspelning, idempotens och aktiva referenser bevarade. Det är en senare skalningsfråga, inte ett konstaterat akut lagringsfel.

### Backup-/restore-rester och avslut

- Sex produktionsgrenar och två previewgrenar utöver main finns kvar. De två `backup-l3-rooms-20261030` har `expires_at=2026-11-06T23:59:00Z` (7 november 00:59 svensk tid). Sex andra backup-/restoregrenar saknar automatiskt utgångsdatum. De är bara 1–4 dygn gamla; återställningsguidens minst en vecka före gallring gäller fortsatt. Vi ändrade inga utgångsdatum.
- Preview har `croupier_staging_restore` (11 214 848 byte), `croupier_staging_restore_o02` (17 514 496 byte) och `neondb` (7 716 864 byte). De två restore-databaserna är tillsammans 27,40 MiB; med standarddatabasen 34,76 MiB. Inga klientanslutningar till dessa syntes i ögonblicksbilden, vilket inte bevisar att de kan raderas. Bindningar och återställningsbehov måste kontrolleras vid ett senare gallringsbeslut.
- Neons projektmetadata redovisade cirka 45,77 GB respektive 159,75 GB datatrafik med konsumtionsperiod 21 oktober–1 november. Det är **trafik, inte lagrad databasstorlek**, och är inte en uppmätt aktuell tillväxttakt. Orsak och eventuell kostnadsoptimering är inte fastställda i denna lagringskontroll.
- Inga återkommande raderingsjobb eller påminnelser har skapats. För avslutet behövs ingen ytterligare omedelbar städning i Neon. Behåll säkerhetskopiorna och de två lokala testerna; använd denna rapport och [övergångsplanen](2026-10-31-clean-repository-plan.md) om repo-bytet tas upp igen.
