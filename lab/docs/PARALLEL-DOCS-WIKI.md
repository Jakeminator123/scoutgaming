# Agentuppdrag: en aktuell dokumentationskälla, wiki och möjlig webbavveckling

Kopiera uppdraget nedan till dokumentationsagenten.

---

Du ansvarar för Croupiers dokumentation, inte implementation eller drift. Gör den lokala systemkartan och GitLab-wikin aktuella och begripliga. Utred och förbered att vi kan sluta använda den separata webbplatsen `https://animation-events-v1.vercel.app/`. Stäng inte av eller radera webbplatsen utan mitt uttryckliga godkännande efter din verifiering.

## Arbetsgränser

- Arbeta i `C:/Users/jakem/Projects/croupier` på `jakeminator123/work`. Följ gällande AGENTS.md. Bevara andras dirty/untracked filer; ingen reset, clean, force-push eller push till Croupiers main.
- En annan agent bygger OpenClaw och huvudagenten arbetar med labbgränssnittet. Ändra inte deras källkod, konfiguration, mediefiler, nycklar eller körande processer. Läs aktuell kod och samordna dokumentationsstatus, men väck inte andra agenter brett och starta inte om Gateway.
- Läs inte, indexera inte och återställ inte `random-stuff-jakob/jakob-docs/arkiv/`. Den aktiva systemkartan utanför arkivet får och ska användas.
- Publicera aldrig privata anteckningar, konversationsexporter, råloggar, sessions-/spelaridentifierare eller hemligheter. Inga nya publika kopior. Den avsedda nya publiceringsytan är den befintliga Croupier-wikin i GitLab.

## Börja med de aktiva källorna

1. `docs/JOHN-HANDOFF.md` och `docs/ENVIRONMENT-RESTORATION.md`.
2. `lab/docs/README.md`, `lab/docs/guide.json` och `lab/docs/studio-contract.json`. Kontrollera vad som faktiskt renderas i labbets Guide; undvik en tredje fristående användarguide.
3. `random-stuff-jakob/jakob-docs/systemkarta/README.md`, dess `START-HAR.md`, `KALLOR.md` och relevanta kapitelsidor. Det är den aktiva lokala systemkartan.
4. `docs/animation-events/README.md`, `docs/animation-events/v5-7-days-mvp/` samt `docs/animation-events/V5-PUBLICATION.md`.
5. `open-claw/lab/docs/README.md` och dess officiella/deployed-version-index innan du beskriver OpenClaw. Läs även `LOCAL-CONNECTION-SV.md` och verifiera om den parallella agenten därefter levererat något nytt.

## Del A — kartlägg och verifiera, anta inte att speglar är aktuella

Lokal dokumentation säger att Croupiers V5-filer är källa; GitLab-wikin och GitHub-repot `Jakeminator123/animation-events-v1` är speglar/läsytor, och Vercel bygger webbsidan från det senare. `v1` är historiskt repo-/domännamn, inte dagens dokumentversion. Senaste lokala publiceringskvittot är daterat 21 september 2026 och bevisar inte dagens paritet.

Inspektera aktuella revisioner, relevanta filhashar och navigation i Croupier, den autentiserade GitLab-wikin `https://gitlab.com/scout-gg/croupier/-/wikis/animation-events`, webb-repot och den publicerade sajten. Dokumentera vilken yta som har unikt innehåll, hur det synkas och vad som saknas. Använd befintliga autentiseringsvägar utan att skriva ut hemligheter. Saknad åtkomst ska redovisas som blockerad kontroll, inte som bekräftad synk.

Enligt den aktiva CANVAS.md finns `tools/sync-docs.mjs`, `build-static.mjs` och `tools/build-site.mjs` i webb-repot, inte nödvändigtvis Croupier. Synkverktyget kan fortfarande hänvisa till den gamla mappen `v5-8-days-mvp`; faktisk källa heter `v5-7-days-mvp`. Läs verktyget innan det används. Ta reda på om wikisynken kräver webbbygget och om wiki-HTML bara visas som källtext. Markdown-paritet är inte bevis på bevarad interaktiv navigation, sökning, diagram eller djuplänkar.

## Del B — uppdatera lokal källa och publicera verifierad wiki

- Beskriv vad användaren faktiskt kan göra nu med Eventstudio, videobank, native-observation och idlepolicy. Byt ut inaktuella påståenden om gamla seedvarianter som om de vore faktiska videofiler.
- Kontrollera manifest-v2-familjerna mot både kod och mappar: `deal/<familj>/<standard>.mp4` och `variant/`, `repliker/<familj>/<standard>.mp4` och `variant/`, samt basloopar i `idle/` och engångsvariationer i `idle/variant/`. Tom variantmapp ger standard; högst fyra tillåtna varianter. Klippets existens är inte godkänd läppsynk.
- Förklara exakt position: box 0–6 motsvarar deal_pos1–7; replik väljs med exakt line-ID. Kortvärde, handIndex och tillåten spelaridentitet är eventdata, inte separata filmer eller vänster/mitten/höger-gissningar. Dolda kort ska inte läcka.
- Skilj basloop, automatisk idlevariant, regelstyrd variant och OpenClaw-valbar variant. Förklara grundvikt kontra faktisk tidsandel, intervall/slump/cooldown, lokalt minutprov och att preview inte bevisar produktens live-scheduler.
- Skilj native-observation, Partner-SSE, renderad uppspelning och modellens faktiska indata. Skilj publika spelfakta från serverhemligheter och autentiserad identitet. Påstå inte att en öppen anslutning eller lokalt klippkvitto bevisar produktintegration.
- Skilj operatörschatt/Director från produktens strukturerade talbeslut. Commit `1219d98` dokumenterade fungerande labbrelay men saknad privat produkt-Gateway-URL och fel standardroll; detta är en daterad utgångspunkt, inte facit efter den parallella agentens arbete. OpenAI ska behållas, inte ersättas med Gemini. Beskriv pose-grind/startposition och dess verkliga verifieringsstatus.
- Skilj originalfilens bildformat från mobil-/desktoplayout. Förklara att `?rehearsal=1` öppnar produktens befintliga QA-panel, inte en ny Eventstudio-flik.
- Använd tydliga statusord: kodkontrollerat, lokalt provat, driftsatt/verifierat, återstår. Ange datum/revision och konkreta bevis. Flytta inte fram historiska testkvitton och kalla inte syntetiska testresultat mänskligt lipsync-godkännande.
- Uppdatera systemkartan, källregistret och relevanta guider utan onödiga dubbleringar. Publicera motsvarande uppdatering i den befintliga GitLab-wikin och kontrollera den publicerade texten, interna länkar och rättigheter.

## Del C — gör wiki oberoende av den separata sajten

Inventera aktiva länkar, diagram, bilagor, sökning, HTML, bygg-/synkskript, CI och eventuella appberoenden till `animation-events-v1`. Bevara nödvändigt material och funktionalitet i den kanoniska dokumentationen och wikin. Om något bara fungerar på webben, redovisa detta och skapa en begriplig wiki-/lokal ersättning eller be om beslut.

Förbered en reproducerbar wiki-only-publiceringsväg om dagens synk kräver webb-repot. Använd befintliga verktyg där det är rimligt; bygg inte en ny dokumentationsplattform. Peka aktiva läsanvisningar mot den verifierade wikin/lokala källan först när måltexterna faktiskt finns. Bevara historiska kvitton och gamla länkar som historik; gör ingen global massersättning.

Leverera därefter en kort avvecklingsrekommendation: exakt Vercel-projekt/repo/koppling, kvarvarande användare/länkar, vad som bevarats, eventuell förlust av publik åtkomst, föreslagen omdirigering eller hänvisningssida och återställningsplan. Fråga mig då om sajten ska stängas eller lämnas som hänvisning. Radera inte repo, deploymenthistorik, domän eller källdokument; koppla inte bort Git/CI/Vercel före mitt beslut.

## Leveranskrav

Kontrollera ändrade länkar, dokumentationssynk och relevanta tester. Visa publicerade wikiadresser och källrevision/hash, inte bara att push lyckades. Ange vad som ännu inte är verifierat. Vid otillgänglig wiki: gör klart lokal dokumentation och en publiceringsklar diff, men rapportera att publicering är blockerad.

Följ repoets inbox-/Jira-/samordningsregler. Kör `node tools/croupier-chef.mjs status` före gemensam integration/push och koordinera med eventuell registrerad ägare. Committa bara egna filer; leverera Croupier-commit via `node tools/push-work-mirrors.mjs` till GitLab och privata `Jakeminator123/github-work`. Hantera wiki-repot separat efter verifierad remote/branch. Uppdatera handoff med ändringar, prov, publiceringskvitto och kvarstående avvecklingsbeslut. Ändra inte Jira-status utan faktisk verifiering av relevant Expected Result.
