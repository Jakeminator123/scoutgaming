# V3 · 9-dagars MVP

> Det här är Jakobs dokumentations- och integrationsunderlag. Det ändrar inte Kevins branch, motor eller agentregler automatiskt.

V3 utgår från Kevins befintliga Croupier-motor, RNG och events. Målet är att på nio avgränsade arbetssteg skapa ett verifierbart eventträd och en säker mappning till videovarianter, utan att konstruera en konkurrerande spelmotor.

## Läsordning

1. [s00 · helheten](s00-helheten.md)
2. [s01 · kartan](s01-kartan.md)
3. [s02 · språket](s02-spraket.md)
4. [s03 · eventträdet](s03-eventtradet.md)
5. [s04 · säker presentation](s04-saker-presentation.md)
6. [s05 · ordlistan](s05-ordlista.md)
7. [s06 · 9 dagar](s06-plan.md)
8. [Beslutslogg](DECISIONS.md)
9. [Verifierad runtime-evidens](RUNTIME-EVIDENCE.md)
10. [Visuell canvas · eventträdet](CANVAS.md)

## Klart när

- Varje rot i eventträdet kan spåras till verifierad Croupier-kod, payload eller snapshot.
- Föreslagna/deriverade noder är tydligt märkta och påverkar inte RNG, kort, wallet eller payout.
- Video och metadata har en ägare, en källa och en säker fallback.
- Jakob kan visa en reproducerbar rehearsal och en gapplista.
- Kevin har vid en etapp valt att införliva, justera eller låta arbetet fortsätta separat.
