# Dokumentordning — en aktiv plats per ämne

[Systemkartan](../README.md) · [Kort start](../START-HAR.md)

Införd 25 september 2026 på Jakobs begäran. Roten `jakob-docs/` har bara en
aktiv README-vägvisare. Sakuppgifter ligger under systemkartans sex ämnen.
Användarguide, sprint och gemensam handoff behåller sina befintliga källor;
systemkartan länkar dit i stället för att kopiera deras innehåll.

## Så hålls det rent

- Uppdatera en befintlig ämnessida när fakta ändras. En lång referens får en
  namngiven fördjupning under ämnet; skapa inte en ny daterad rotfil.
- Märk vad som är kod, provad drift, historisk evidens respektive förslag.
  Gamla testantal eller serverkontroller behåller datum och revision.
- Skriv leverans/testutfall i `docs/JOHN-HANDOFF.md`, inte i nya privata
  ARBETE-/HANDOFF-kopior. Spara bara unika kvarstående krav i ämnessidan.
- Ta bort överspelade dubletter från arbetskopian efter sammanslagning och
  länkkontroll. Git bevarar originalen; en andra historikmapp behövs inte.
- Skanna inte privata åtkomstfiler, env-värden, råkonversationer, mediefiler
  eller det pensionerade personarkivet för att orientera en agent.

## Flyttat och fortsatt aktivt

- `KORT-START-HAR.md` → [START-HAR](../START-HAR.md).
- `_env.explanation.md` → [Miljö och API](../05-openclaw-rost-och-drift/MILJO-OCH-API.md).
- `2026-09-20-eventregister-och-mental-modell.md` → [Eventregister](../02-events-triggers-urval/EVENTREGISTER.md).
- `2026-09-20-situationer-variantfamiljer-och-takes.md` → [Signaler och takes](../02-events-triggers-urval/SIGNALER-OCH-TAKES.md).

## Sammanslaget och borttaget ur den aktiva roten

- `ARBETE-2026-09-21-ORIGINAL-OCH-OPENCLAW.md`,
  `HANDOFF-2026-09-21-LIVE-OCH-2D.md` och
  `PROMPT-2D-MOCKUP-FRAN-SPELFLODE.md`: nuläge och relevanta återstående krav
  finns i [Livejämförelse](LIVEJAMFORELSE.md). Historiska körkvitton finns redan
  i [gemensam handoff](../../../../docs/JOHN-HANDOFF.md) och
  [Runtime-evidence](../../../../docs/animation-events/v5-7-days-mvp/RUNTIME-EVIDENCE.md).
- `ARBETE-2026-09-21-V5.md`: ersatt av den [aktiva sprinten](../../../../docs/animation-events/v5-7-days-mvp/README.md)
  och det daterade [publiceringskvittot](../../../../docs/animation-events/V5-PUBLICATION.md).
- `PROMPT-OPENCLAW-SOM-TALAGARE.md`: var redan bara en vägvisare till
  [den kanoniska talbriefen](../../../../lab/docs/OPENCLAW-SPEECH-OWNERSHIP.md).

De fem borttagna rotfilerna finns oförändrade i Git vid **`17afbf1`**, under
`random-stuff-jakob/jakob-docs/<filnamn ovan>`. De kan läsas/återställas vid
ett uttryckligt behov av just det historiska dokumentet. Lägg inte tillbaka
hela samlingen som aktiv dokumentation och följ inte gamla instruktioner
som om de vore aktuella. Det pensionerade `arkiv/` har varken lästs, flyttats
eller återställts; det är en annan samling än dessa fem rotfiler.

`KEVIN-ATKOMST-PRIVAT.txt` ligger kvar lokalt och Git-ignorerad, utan att dess
innehåll lästs eller kopierats. Inga miljövärden, media eller sparade
labbprojekt har flyttats eller raderats.
