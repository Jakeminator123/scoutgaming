# Överlämning: Scoutgaming-migreringen

Datum: 26 oktober 2026. Beställd av Jakob för en ny agent, eventuellt på annat Codex-konto/dator. Detta är en startpunkt och ett daterat kvitto, **inte en ny migrationsplan eller statuskälla**.

## Uppdrag och användarens senaste beslut

Fortsätt selektiv migrering från Kevin-referensen till ren `main`: Neon är produktregister, Blob lagrar mediebytes och presentationen använder separat bakgrund, dealer och bord. Återanvänd bra klipp-/multitablelogik; återinför inte ersatt Control, lokal QA-produkt eller gamla register. Kevin-staging kan granskas på GitHub, men arbetet får inte bero på Kevins GitLab eller körmiljö.

Jakob bekräftade efter leveransen: **”allt såg ganska bra ut gällande paow för johns spelbolag”**. Han hade också provat skarven i extern webbläsare. Bevara den fungerande demon. Detta bekräftar utseendet, inte full spelrunda, tal/läppsynk eller alla filmövergångar. Hans tidigare godkännande av tio PAOW-talklipp ska omkontrolleras; han beskrev det som ”sloppy”.

## Läsordning och första steg

1. Läs aktuell `AGENTS.md`, kontrollera checkout, branch, HEAD och lokala ändringar. Återanvänd befintligt arbete; ingen bred reset, clean, stash eller omladdning av originalcheckouten.
2. Läs [masterplanen](https://github.com/Jakeminator123/scoutgaming/blob/main/migrering/MASTERPLAN.md) och [enda statuskällan](https://github.com/Jakeminator123/scoutgaming/blob/main/migrering/status.json). Status efter fortsatt granskning: **60 % = 12/20 verifierade aktiviteter**. J09 är verifierad som avvecklingsförberedelse; faktisk produktions-DDL ingår fortsatt i O03.
3. Läs de senaste avsnitten i [JOHN-HANDOFF](https://github.com/Jakeminator123/scoutgaming/blob/main/docs/JOHN-HANDOFF.md), sedan relevanta delar av `docs/ENVIRONMENT-RESTORATION.md`, `docs/CLOUD-MIGRATION.md` och `docs/LOCAL-PRESENTATION-RUNTIME.md`. Sök i historiska avsnitt; äldre gapbeskrivningar är inte automatiskt aktuella.
4. Kontrollera nya relevanta meddelanden i [samordning #312](https://github.com/Jakeminator123/scoutgaming/issues/312), aktuella PR:er och faktisk drift. Återuppta inte redan mergat arbete.
5. Använd Node **24.21.0** genom Volta, högst fyra testarbetare. Kör `node tools/agent-talk.mjs status <eget-id>` innan nya filanspråk och före commit/push. Claima egna filer och `.git`; läs chef-status före integration/push.

## Senaste fortsättningen: Kevin-konvertering och nästa etapp

Läs det översta kvällsavsnittet i [JOHN-HANDOFF](JOHN-HANDOFF.md). Jakob vill att nyare Kevin-underlag och verkligt produktbeteende väger tyngre än historiska lås. Två duplicerade material-/timinglås är borttagna och 62/62 relevanta beteendeprov passerar. Nästa etapp implementerar nåbar varianttäckning, fryst v2-filmplanering, v31-readiness och explicit Admin-bindning på `codex/reachable-filmed-coverage-20261026`. Läs översta handoffen och faktisk PR-/CI-/driftstatus innan arbete återupptas; koden ger inte AV-acceptans eller nya migrationsprocent.

Isolerad staging innehåller nu 46 exakt bundna, servermätta PAOW-original och en separat sparad PAOW-scen. Tio talval passerar i riktig pending-repetition; inget nytt AV-godkännande eller publicerat rum finns. Projektrevision `studio-989f1e1b-7430-44b6-8ae2-1eeab40c468a`. Staging använder fortfarande syntetiska bakgrunds-/bordslager. Full spel-, AV- och layoutacceptans återstår; aktuell status är fortfarande 60 %. Root har beställt sömlös fortsättning i en ny chatt med privat överlämning, inte en ny migrationsplan.

## Levererat och kvarvarande arbete

Fortsatt isolerad runtime har verifierats på `d89048625d127d159101707fe46547a6108987f6` (PR414) och säkerhetshead `a22f7a97dc1f29d91400cb7becc33073bff3d11d` (PR416, mergad som `291dba91924bd432c88733aa28a3bf5db8fe9257`). Hämta aktuell main och läs senaste JOHN-HANDOFF vid övertagandet; en fryst testversion är inte automatiskt senaste produktionsdeploy.

| Leverans | Resultat |
|---|---|
| [PR407](https://github.com/Jakeminator123/scoutgaming/pull/407) | Mergad. Aktiv hand behåller fryst material/rumskonfiguration; obligatoriskt verkligt Chrome-prov passerade. |
| [PR409](https://github.com/Jakeminator123/scoutgaming/pull/409) | Mergad. Oanvänd LegacyClipEditor och exklusiva hjälpare/tester borttagna; aktiva editorer bevarade. |
| [PR411](https://github.com/Jakeminator123/scoutgaming/pull/411) | Mergad. 161 frysta Astrid-testsvar och exklusiv testkedja borttagna; 8 oanvända partnerbilder borttagna. Dealerisolering och negativa prov finns kvar. Inga originalfilmer raderade. |
| [PR412](https://github.com/Jakeminator123/scoutgaming/pull/412) | Mergad. Partnerportalens oanvända demodatabas/mockruntime ersatt av verklig arbetskontext. Rumsutkast, behörighet och revisionsskydd bevarade. |
| [PR413](https://github.com/Jakeminator123/scoutgaming/pull/413) | Mergad. Dokumenterar publicerad PAOW-demo och faktisk verifiering. |
| [PR415](https://github.com/Jakeminator123/scoutgaming/pull/415) | Mergad. En gemensam regression och fullständig backupväg; felaktigt shadersträngslås, oanvänd JSON-backup och dubbla teststarter borttagna. Push-hjälparen stöder smal fetch-konfiguration. Full CI passerar. |
| [PR416](https://github.com/Jakeminator123/scoutgaming/pull/416) | Mergad. Next 16.4.1, Undici 6.29.1 och scopebunden Zod 4.6.6; noll produktionsauditfynd i båda paketen. Full CI/container/GitGuardian, 13 isolerade HTTP-prov och SQL-paritet passerar. |
| PR408 / PR410 | Stängda, inte mergade. PR408 ersattes av PR409. PR410 återläst som CLOSED på head `2b65e4cbe076dc6bac934233ec8102fbb13c5fd3`; behandla den inte som väntande release. |

PR409/411/412 har grön CI på respektive fryst head. Integrerad main `a95f5b9ba138ba310d1dc02b9107b2dae5346395` passerade [full CI40355438860](https://github.com/Jakeminator123/scoutgaming/actions/runs/40355438860), inklusive Chrome och produktionsledgerns readiness. PR413:s dokumentations-CI [40358868999](https://github.com/Jakeminator123/scoutgaming/actions/runs/40358868999) passerade; full regression var korrekt ej tillämplig för den rena dokumentändringen.

## Fungerande demo: bevara denna bas

- [Johns Bet – PAOW Blackjack](https://www.scoutgaming.tech/play/blackjack?operator=johns-bet&table=room-76640ca1-b619-7948-596e-3d102202b7d0)
- [PAOW Studio – PAOW Blackjack](https://www.scoutgaming.tech/play/blackjack?operator=paow-studio&table=room-65390c43-00c7-08a6-fb44-a6083276f2a1)
- Båda har **paketversion 5**, återläst i Neon även vid denna överlämning. Inloggning kan krävas. `Johns Bet` skapades genom ordinarie Admin; inga egna spelkommandon/insatser ingick i provet.
- Gemensam mall: `paow-studio-blackjack-e9a6193d-6bf3-4774-b505-538d6507bf3d`.
- Dealer `paow`; bakgrund Midnight-variant-1 `6daa1434-674c-4a43-bcc7-0a4e93fae62a`; bord Blackjack · Oak `f00be01d-fe7c-4a43-85b9-952e378f7331`.

| Format | Dealer skala / X / Y | Bord bredd / X / Y |
|---|---|---|
| Desktop | `1 / 0 / 0.03` | `0.95 / 0 / 0.27` |
| Mobil | `1 / 0 / 0` | `2.6 / 0 / 0.26` |

Bakgrundens skala/läge är oförändrade; `tableFront=false`. Gemensamt mallutkast är inte samma sak som publicerat bolagspaket: geometri sparas i Sceneditor och publiceras via befintlig `publish-scene-layout` med revisionskontroller. Ändra inte ett delat mallutkast i tron att det bara påverkar ett rum. Använd avsett `roomOverrides` för rumsspecifika val.

Den delegerade chatten ”Felsök webview i Codex Work” kontrollerade båda spelvyerna i **390×844, 1280×720 och 1440×900**: inga geometrivarningar, synligt huvud/händer, tät skarv, sparning efter omladdning och formatbyte. Rotchatten granskade slutbilder och avkodade båda frysta paketen: identisk geometri, oförändrade medie-ID. West Bet, kortankare, filmade banor och talgodkännanden ändrades inte. Egna extra provflikar stängdes; Johns Bet och Admin lämnades öppna.

En mellanversion såg bra ut vid 1440×900 men gav korrekt varning vid 1280×720 eftersom insatsplatser överlappade HUD. Detta löstes med slutgeometrin ovan, utan kodändring eller borttagen varning. Återgå inte till mellanversionernas större desktop-dealer.

## Åtkomst på ett annat konto

Behörigheter, inloggade browserflikar och MCP-anslutningar följer inte en textöverlämning. Anslut rätt GitHub-, Neon-, Vercel- och Render-konton på vanligt sätt. Paketet innehåller inga lösenord, tokens eller databasanslutningssträngar. Testa webview i den nya chatten; ett tidigare nekande var chattspecifikt, medan en annan chatt fungerade.

| Resurs | Identitet / senaste observation |
|---|---|
| GitHub | `Jakeminator123/scoutgaming`, repo-ID `1380630440`, målbranch `main`. |
| Vercel | Team `scoutgaming` / `team_Scxorb9qtZHjNae1YEQnFCaT`; projekt `prj_VwxGpN2kOJ5gXStgM9wMWE0EbULD`. READY på `291dba91924bd432c88733aa28a3bf5db8fe9257`, deploy `dpl_Ck66fKCYFTJeUyfNJBiqZNbJoggG`, alias `www.scoutgaming.tech`. Publik lobby/inloggning och anonym behörighetsgräns kontrollerade. |
| Render | Jakob godkände workspace `tea-d19jsa63jp1c73ch0sc0`. Produktion **croupier-v3**, service `srv-dbd6nfon74is73aiblf0`. LIVE på `a22f7a97dc1f29d91400cb7becc33073bff3d11d`, deployment `dep-dbfpasfb9u1s738nss10`. Tolv health-/versionsprov efter LIVE passerar och är bundna till ny process. |
| Neon produktion | Projekt `wandering-hill-60561912`, branch `br-flat-fog-b161a6r8`, databas `croupier_game`; scope `production` / `croupier`. |
| Neon isolerad staging | Projekt `red-violet-36066351`, branch `br-plain-voice-b9yu49xi`, DB `croupier_staging`; scope `staging_k06_k07` / `croupier`. En befintlig QA-mediepost och 46 nya exakt bundna PAOW-original; talreview pending. Ingen publicerad delad bordskonfiguration. |
| Render staging | `croupier-k06-k07-staging`, `srv-dbf61l0m7kps73ft7mk0`: återupptagen för isolerad repetition, LIVE `dep-dbfrl8d9fdbs739tnp8g` på f153. Branch rättad till `main`, autoDeploy av. Kontrollera aktuell ägare före användning/stopp; stoppa efter prov. |
| Vercel staging | Befintliga `prj_7dgyvW5zakx1qJ8YaH5pueVTVi14`, `croupier-k06-k07-staging.vercel.app`, är åtkomligt genom anslutna `mcp__user_vercel`. Tidigare 404 var anslutningsspecifik. Senast READY dpl_6pAacVPeZBx1iUHYqbAtRKqNjehC på a22f7a97 efter vanlig Admin-/spelkontroll. Backend är nu avsiktligt stoppad. |

`recordedSpeech` **v2** är MP4-talformat med inbäddat ljud, inte Render-motorn v2. Motorn är v3. Native materialresolver, serverägd mätning och MP4-formatet är redan implementerade. Delat spel var fortsatt avstängt enligt releasekvittot; aktivera inte produktionsflaggor som bieffekt av tester.

GitGuardian återläst på main `291dba91924bd432c88733aa28a3bf5db8fe9257`: källbindning verifierad, incidenttäckning komplett för källan, 0 öppna/23 ignorerade, monitorering aktiv. Historisk skanning `too_large`, platsmetadata partiell. PR416:s GitGuardian-check passerade; merge-versionens check väntade vid den separata statusläsningen. Grön CI betyder inte full historisk säkerhetstäckning; läs färsk status före nya kod-/konfigurationsändringar.

Separat driftnotering: efter Render-releasen sågs tillfällig `drift_executor_busy` för Dragans genererade tal. Senare 69 sekunder utan readback-fel och tre förnyade SQL-observationer med stabil leaseägare stöder återhämtning. Rotorsaken till konkurrensen är okänd; detta ändrar inte PAOW:s acceptansstatus. Detaljer i senaste JOHN-HANDOFF.

## Nästa konkreta arbete

1. **K05 / K04:** granska och bind exakta PAOW-takes. Fortsatt bytegranskning verifierar 74 taloriginal och 35 filmoriginal mot exakta SHA och full decode; 74 talstorlekar och 35 film-frameantal matchar. Tio svenska _1-kandidater hämtade via befintlig Admin matchar originalbytes. Detta är fortfarande inte ljud-/bildacceptans. Det finns ingen verifierad slutlista över de tio godkända tagningarna. Slots: `blackjack`, `dealerblackjack`, `dealerbust`, `double`, `goodluck`, `insurance`, `lose`, `placebets`, `push`, `win`; svenska/engelska och flera alternativa tagningar förekommer. Återanvänd registrerade original och befintliga tjänster; massimportera/regenerera inte.
2. **J08 / K06 / K07:** använd isolerad miljö, syntetiska konton och separat hostname. Verifiera Admin → sparning → publicering → spel, aktiv hand under ny publicering, nästa hand, multitable/samtidighet och autentiserad återanslutning i den fulla material-/delatbordskedjan. Återanslutning av en native demo-hand efter verklig processomstart är redan verifierad. Kontrollera exakta materialidentiteter, filmprofil, kontakt/handfrigörande och tidsbudget. Varken layoutdemon eller CI ersätter denna samlade acceptans.
3. **J10 / O02 / O03:** komplettera HTTP-spelreplay efter restore, oberoende integrerad granskning och faktisk driftacceptans när förkunskaperna är verifierade. J09:s förberedelse är VERIFIED efter oberoende review; dess tidigare J08/K05-förkunskaper saknade faktisk koppling och är borttagna. Radera inte produktionsdata utan separat mandat och återställningsunderlag. Uppdatera endast `migrering/status.json` när respektive kriterium verkligen är uppfyllt.

Relevant kod: `apps/studio/lib/presentation-room-api.mjs`, `operator-package-api.mjs`, `studio-document-api.mjs`; `packages/presentation/runtime/{presentation-composition,composition-anchors,game-overlay-layout}.mjs`; `packages/presentation/contracts/filmed-profiles/registry.mjs`; `services/game`. K05:s aktuella väg finns i `migrering/kevin-ks-migrering/K05/MAPPNINGSSYSTEM.md`. Källmanifestet `apps/studio/lib/dealer-import-kevin-source-paow.json` är stort: parsa och välj fält, skriv inte ut hela filen.

## Privata bevis och lokala resurser

Den separata ZIP-överlämningen innehåller denna text, sex slutbilder, webview-agentens JSON-kvitto och den privata PAOW-talgranskningen. Dessa bevis är inte ett produktregister och ska inte checkas in. På en annan dator behöver ZIP-filen bifogas separat; gamla `C:/Users/...`-länkar fungerar inte där. Saknas bilderna kan repoets handoff användas, men hävda inte egen visuell verifiering utan att se dem eller göra ett nytt prov.

- Arbetskopian för detta uppdrag: `C:/Users/jakob/.codex/worktrees/migration-takeover/scoutgame`.
- Originalcheckout: `C:/Users/jakob/dev/projects/scoutgame`; användarens egna ändringar där har bevarats. Även `paow-clip-standard`-worktreen tillhör annat arbete.
- Privat gransknings-ZIP: `C:/Users/jakob/.codex/visualizations/2026/10/26/01a17942-eb9b-7312-a6dc-0811bd63afa7/paow-media-review-2026-10-26.zip`, 36 filer, utan lösenord eller sessioner. Packa upp och öppna review.html för de tio ännu ej AV-godkända kandidaterna.
- Fortsatt privat byte-/bildgranskning: `C:/Users/jakob/dev/projects/scoutgame/arkiv/2026-10-26/migration-continuation-paow/review.html`, med `source-byte-audit.json`, `served-byte-audit.json` och `review-candidates.json`. Kandidaterna är inte AV-godkända.
- Privat talunderlag finns i `arkiv/2026-10-26/migration-takeover/paow-speech-review.json` och `.md`, även kopierat till originalcheckouten. Status i filen: `TECHNICAL_INVENTORY_ONLY_NOT_APPROVED_FOR_PLAY`.
- Webview-bevis: `C:/Users/jakob/.codex/visualizations/2026/10/26/01a178d1-5a0d-7312-9d2f-86bdc3a17307/`, filer `johns-bet-paow-verifiering.json` och `*-v5-*.jpg`.
- Inga egna testservrar behöver hållas igång. Egna mergade lokala brancher städades; säkerhetsworktreen game-zod-advisory är återställbart arkiverad efter PR416 och ren status, utan privat återställningsmaterial; återställningsbranchen `codex/migration-handoff-20261026` för stängda PR408 bevarades eftersom den inte är grafmergad. Radera inte andras eller tveksamt återställningsarbete.

Leverera nya ändringar genom egen featurebranch och PR via `node tools/push-github-work.mjs`. Bevara skydd för behörighet, isolation, revisioner, samtidighet och spelregler. Verifiera PR-ägare/källrepo/exakt head mot betrodd aktuell `inbox/people.json` före merge. Ett annat Codex-konto innebär inte automatiskt rätt GitHub-identitet; andra ägares arbete eller oklar identitet kräver AGENTS-regelns särskilda godkännande. Använd aldrig direkt main-push eller force-push som genväg.
