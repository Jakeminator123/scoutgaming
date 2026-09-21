# Scout-brandad Croupier Lab-dashboard

Den här versionen använder idéerna från
`Jakeminator123/cyberpunk-dashboard-design` som ett visuellt underlag, men
dashboarden ligger direkt i Croupiers riktiga Studio. Det finns därför ingen
iframe, ingen kopierad labblogik och ingen andra källa för projektdata.

## Designprincip

- **Croupier Lab är standardvyn.** `/` renderar fortsatt `StudioPage` med
  Eventstudion som startläge.
- **Scout först, cyberpunk som djup.** Scout-paletten är `#0A0B0D` (ink),
  `#F2F1ED` (off-white), `#D6FF3A` (lime), `#B5DC1F` (djup lime),
  `#5A6470` (steel) och `#1F252E` (djup steel).
- **Snedstrecket är märket.** Logotypen är kodbaserad eftersom inget
  `image.png` fanns i underlaget. Orden är lugna och off-white; bara `/` är
  lime, glöder svagt och roterar i 3D.
- **Rörelse för orientering.** Header, sidomeny, arbetsyta och inspektör
  kommer in i en kort ordning. Bordet får perspektiv och en långsam scanner,
  aktiva noder flyttar sig några pixlar. Rörelsen ändrar aldrig event- eller
  uppspelningslogik.
- **Tillgänglighet går först.** `prefers-reduced-motion: reduce` stänger av
  nya animationer och 3D-transformer. Fokusmarkeringar och befintliga
  tangentbordsflöden är kvar.

## Pedagogisk struktur

Dashboarden behåller labbets arbetsordning i gränssnittet:

1. välj dealer och event i vänsterspalten,
2. se presentationen i mitten,
3. redigera standard/alternativ och triggers i inspektören,
4. kör testet och läs beslutsspåret,
5. kontrollera uppspelningen i Händelseloggen.

Bottenraden sammanfattar samma flöde: **Indata → Presentationsbehov → Standard
eller alternativ → Uppspelning**. Lime betyder aktivt val eller systemstatus,
inte dekoration.

## Kör lokalt

Från repots rot:

```powershell
.\Start-Labb.cmd
```

Öppna `http://127.0.0.1:4188`. För direkt utveckling i `lab/` kan du även köra
`npm run dev`. Produktionskontroll körs med `npm run typecheck`, `npm test` och
`npm run build`.

## Filer

- `lab/app/globals.css` — Scout-tokens, ytor, 3D och animationer.
- `lab/components/studio.tsx` — kodbaserat wordmark och samma befintliga Studio.
- `lab/app/layout.tsx` — titel och beskrivning för Croupier Lab.
- `lab/components/dashboard-brand.test.mjs` — skyddar palett, wordmark och
  reduced-motion-fallback.

Ändringen påverkar inte serverägda speldata, dealerfilmer, ljud, frame-index,
kalibrering eller produktspelaren.
