# Croupier · Presentationsplan V5

**25 september 2026 · sju återstående arbetsdagar · Jakob, Kevin och Emil.**

[Läs den aktuella wikin](https://gitlab.com/scout-gg/croupier/-/wikis/animation-events) ·
[Äldre publik webbsida från 21 september](https://animation-events-v1.vercel.app/) ·
[Nästa sju dagar](s06-plan.md) ·
[Portabel sjudagarshandoff](HANDOFF-7-DAGAR.md)

Vi har en lokalt verifierad kedja från mottagen presentationsinstruktion till
variantbeslut och uppspelning. Det aktiva manifestet har schema 2 och innehåller
31 poster i 26 familjer: åtta deal-familjer, sjutton speech-familjer och en
idle-familj. Produktens separata OpenClaw-talroll och Director-adapter är byggda
och testade lokalt, men privat produkttransport, token, driftsättning och runtime-QA
återstår. Spelservern behåller alla spelbeslut.

## Börja där arbetet finns

- [Portabel handoff för agenter och nya personer](HANDOFF-7-DAGAR.md):
  D0 + sju dagar, system, API-kopplingar, lagring, evidens och startprompt.
- [Helheten och dagens leverans](s00-helheten.md): byggt, beställt och kvar.
- [System och mappar](s01-kartan.md): labb, native, Partner, BO och manifest.
- [Signaler och observation](s02-spraket.md): RNG, events, beslut och kvitton.
- [Lägg in video och koppla triggers](s03-eventtradet.md): Kevin/Emils arbetsgång.
- [OpenClaw, läppsynk och acceptans](s04-saker-presentation.md): ägarskap och kontroll.
- [Ordlista](s05-ordlista.md): begrepp som annars lätt blandas ihop.
- [Sjudagarsplan](s06-plan.md): startgrind D0 och sju genomförandedagar medan Jakob reser.

## Så läser vi status

**Byggt lokalt** betyder att koden finns på `jakeminator123/work`.
**Lokalt verifierat** anger ett daterat prov och dess omfattning.
**Beställd integration** är Jakobs beslut om riktning, inte en färdig runtime.
**Öppet** är en konkret återstående kontroll eller funktion.

Allt i labbet finns inte i backoffice. Push av arbetsgrenen är inte deploy
av Bettalotto. Live-revisionen är ännu inte belagd; generations-API:t gav
`revision: null`. V5 godkänner inga takes och stänger inga CAC-ärenden.

[Ändrat från V4](DECISIONS.md) · [Källor och prov](RUNTIME-EVIDENCE.md) ·
[Publicering och historik](CANVAS.md)

## En källa, en verifierad wiki

Denna mapp är sakunderlaget. GitLab-wikin synkas direkt med Croupiers verktyg och
får ett källcommit och SHA-256 per fil. GitHub/Vercel är en separat äldre
åttadagarswebb från 21 september och ingår inte längre i normal wiki-publicering.
`animation-events-v1` är det historiska repo- och domännamnet. V4 bevaras som
daterad historik. Privata loggar, råa konversationer, personuppgifter och
API-hemligheter publiceras inte.
