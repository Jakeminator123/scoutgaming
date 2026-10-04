# Efterarbete för Croupier

Beställt av Jakob den 4 oktober 2026. Plan 01–07 är en **planleverans** för
andra agenter. Jakob beställde därefter uttryckligen implementation av plan 08.
Faktakontrollen av efterarbetet utgår från `bee4e04ae148bfef781a878672f535f7f3643063`;
aktuell leveransstatus finns i respektive plan och handoffen.

## Min bedömning och föreslagen ordning

Granskarens två kodfynd är riktiga. GPU-väntan har reproducerats isolerat och
zonrouten använder en borttagen sökväg. OpenClaw-knappen har ett tredje,
separat reproducerat fel. De ska rättas före ett nytt slutgodkännande av
de berörda flödena. Den genomförda dataflytten och fysiska avvecklingen
behöver inte göras om.

Mitt tidigare besked ”0 % kvar” avsåg migrationsomfattningen och var för
kategoriskt som besked om hela produktens kvalitet. Bevarade data, fungerande
start och gröna tester bevisade inte de tre flöden som nu visar fel.

| Ordning | Plan | Syfte och resultat | Status |
| --- | --- | --- | --- |
| 1 | [Sluträttningar](01-slutratningar/PLAN.md) | Rätta GPU-shutdown, zonbild/export och OpenClaw-navigering | Fel verifierade; rättningar öppna |
| 2 | [Produktionsacceptans](07-produktionsacceptans/PLAN.md) | Kort autentiserat prov och verifierat GPU-avslut på rätt leverans | Planerad efter rättning |
| 3 | [Systemkarta](02-systemkarta/PLAN.md) | Vanlig HTML-sida med adresser, lagring, databaser och spelflöden | Första HTML-kartan i docs/system-map, 49 tabeller och käll-/testlänkar; full detalj-/driftinventering återstår |
| 3 | [Konton och nycklar](03-konton-och-nycklar/PLAN.md) | Förstå roller, inloggning och varje nyckels rätta placering | Utgår från befintliga register |
| 4 | [Tester och granskning](04-tester-och-granskning/PLAN.md) | Koppla kartans delar till befintliga tester och begränsad oberoende granskning | Planerad stegvis |
| Parallellt | [Historik och arkiv](05-historik-och-arkiv/PLAN.md) | Sammanfatta arbetets faser och besluta om loggars bevarande | Startpunkter verifierade i Git |
| Parallellt | [Driftlägen och lanes](06-driftlagen-och-lanes/PLAN.md) | Förklara OFF, produktion/QA och vägen från provad lane till produktion | Render-flaggor avlästa |
| Beställd implementation | [Mobile Phone Lane](08-mobile-phone-lane/PLAN.md) | Befintlig Astrid/Lissabon-lane på `/blackjack`, aktivt Studio-val och inloggning | Implementerad; faktisk leveransstatus i handoffen |

”Parallellt” betyder att läsning och dokumentation kan göras oberoende. Det
innebär inte att nya agenter, tjänster eller providerjobb ska startas automatiskt.
Jakob har arkiverat de tidigare hjälpagenterna. Han beställde därefter uttryckligen
tre läsande kartläggningsagenter för den första systemkartan; deras underlag är integrerat.

## Bedömning av förslagen

| Förslag | Bedömning |
| --- | --- |
| En extra oberoende granskning | Ja, av sluträttningarna och de ändrade gränserna. Återanvänd bevis för oförändrad kod; granska inte om varje historisk testkörning. |
| En HTML-karta över hela systemet | Ja. Börja med en korrekt, läsbar karta med källänkar och tydlig skillnad mellan produktion, QA och historik. |
| Rödmarkera ändrad databas eller signal | Ja, när ett definierat kontrakt eller dess test inte längre stämmer. En avsiktlig ny kolumn är inte i sig ett fel. |
| Blockera push/merge vid alla kartändringar | Nej som generell regel. Koppla avgränsade, tillförlitliga kontrakt till befintlig CI. Föråldrad text ska först ge en begriplig varning. Leveransbranchen här är `main`, inte `master`. |
| Flytta stora loggar till databas/Docker | Inte utan att identifiera loggen och behovet. Docker är en körmiljö, inte en bevarandeplan. De två stora Markdownfilerna är tillsammans cirka 223 kB. |
| Aktivera allt som är OFF | Nej. QA-spärrar, kamera/mikrofon, adminplacering och olika medielanes har olika syften och kriterier. |
| Kräva exakt prisunderlag före rättning | Nej. Priser är fortsatt backlog; befintlig budget, reservationer och journal gäller. Okänd kostnad förblir okänd. |

## Täckning av Jakobs frågor

1. Efterarbete och extra granskare: plan 01, 04 och 07.
2. Historisk start, HTML-karta, adresser, data, nycklar, spel och privilegier:
   plan 02, 03, 04 och 05.
3. Coachens fynd och slutprov: plan 01 och 07. Coachens uppgift om sex
   produktionsfel på zonrouten är inte självständigt loggavläst här; kodfelet är verifierat.
4. Arkiverade agenter, nästa steg och OpenClaw: plan 01 och 05.
5. Handoffhistorik, arkivering och den stora loggen: plan 05.
6. OFF och möjligt äldre Kevin-arbete: plan 06.
7. Mobile Phone Lane, ny adress, Studio-val och hemsidans Blackjack-knapp:
   plan 08. Faktiskt observerad väntan på tal och läppsynk finns i plan 06.

## Arbetsregler för nästa agent

- Läs aktuell `AGENTS.md`, denna plan och de länkade källorna. Frys aktuell
  remote `main`; basen ovan kan ha ändrats. Ta endast ett avgränsat arbetsblock.
- Använd `node C:/Users/jakem/Projects/croupier/tools/agent-talk.mjs` med
  `status`, faktiska filclaims och `ping`/`ack`/`done`. Bevara befintligt arbete.
- Skriv status, ändrad SHA, prov och kvarvarande fel i respektive plan samt
  kort i [handoff](../docs/JOHN-HANDOFF.md). Driftfakta ägs fortsatt av
  [CLOUD-MIGRATION](../docs/CLOUD-MIGRATION.md) och de befintliga referensdokumenten.
- Planmappen är Jakobs uttryckligen beställda efterarbete. Den ersätter inte
  migrationskvitton och är inte ett nytt allmänt kontrollsystem.
- Inga hemliga värden, kund-/spelaruppgifter, privata chattutskrifter eller
  autentiseringscookies i planer eller framtida HTML. Inga prisutredningar.
- Planleveransen ändrar ingen runtime eller molnkonfiguration. Publicering
  ska samordnas med sluträttningen: main har automatisk Render-deploy och
  den kända shutdown-bristen bör beaktas före nästa omstart.
