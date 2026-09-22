# V5 · samma innehåll på wiki och webb

**Visningsnamn: Croupier · Presentationsplan V5. Planeringsram: sju dagar efter D0.**

Källan är `docs/animation-events/v5-7-days-mvp/` i Croupier. GitLab-wikin och
GitHub-repot `Jakeminator123/animation-events-v1` är läsytor. Vercel bygger den
stabila [webbsidan](https://animation-events-v1.vercel.app/) från GitHub.
Det historiska `v1` i adressen ändras inte i denna leverans.

## Uppdatera en gång och spegla

Mappnamnet ändrades 22 september från `v5-8-days-mvp` till
`v5-7-days-mvp`. Externa docs-repots synkverktyg kan fortfarande ha den äldre
källvägen hårdkodad: uppdatera den i samma framtida publiceringsleverans och
kontrollera manifestet. Lokala dokumentändringar publicerar inte wiki/Vercel.

1. Ändra Croupiers V5-källa och kontrollera påståenden mot kod och prov.
2. Committa den kanoniska dokumentationen på arbetsgrenen.
3. I webb-repot: kör `node tools/sync-docs.mjs --croupier PATH --write`,
   sedan `node build-static.mjs`.
4. Kör synk igen med `--wiki WIKI_PATH --write`. Detta speglar Markdown och
   färdig HTML och skriver källrevision samt filhashar i manifestet.
5. Kör synken utan `--write`, webb-repots tester, `build-static.mjs --check`
   och `tools/build-site.mjs`. Granska navigation, sök, plan och mobilbredd.
6. Pusha Croupiers arbetsgren, wiki och webb-repots publiceringsgren. Kontrollera
   innehållet på den faktiska webbplatsen och wikin efter publiceringen.

Synkverktyget gör inga nätanrop, commits eller pushar. Källor kan läsas utan
Jakobs privata anteckningar. Länkar anpassas per läsyta. GitLab-wikins HTML
kan visas som källkod; länka därför till Vercel för den interaktiva webbvyn.

## Historik och gränser

V4:s texter och webbversion bevaras som historik och märks som ersatta.
Aktiva startsidor/menyer pekar på V5. Äldre versionsuppgifter får inte
massersättas så att historiska prov plötsligt ser nygjorda ut.

Webbpublicering ändrar inte Bettalottos driftsättning, produktmanifest,
OpenClaw-konfiguration eller sparade lokala labbprojekt. Media och råloggar
kopieras inte till webb-repot. Jira CAC är arbetsstatus; dokumentens plan är
underlaget för nästa leveranser.
