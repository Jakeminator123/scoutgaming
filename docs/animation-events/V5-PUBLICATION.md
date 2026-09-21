# V5 · publiceringskvitto 21 september 2026

## Pushad källa och läsytor

- Croupier: `fd51d12727bfa4bfadd2539fece74f337c6ac423` på
  `jakeminator123/work`. Pushen omfattar även `d382b46` och `0b30694` med
  originalförval, observation, native/BO-fixar och gemensamma labbeslut.
- GitHub webb: `f43806ba57de3b96a3840de86794a2b1b6fbd904`,
  `Jakeminator123/animation-events-v1`, publiceringsgrenen `main`.
- GitLab wiki: `6d2996e` i Croupiers separata wiki-repo, `main`.
- [Publicerad V5-webb](https://animation-events-v1.vercel.app/).
- [Publicerad wiki](https://gitlab.com/scout-gg/croupier/-/wikis/animation-events).
- [Videoguide för Kevin/Emil](https://animation-events-v1.vercel.app/#s03/lagg-in-i-videobanken)
  och [åttadagarsplan](https://animation-events-v1.vercel.app/#s06).

Detta kvitto tillkommer efter källcommitten. Webbens synkmanifest anger
`fd51d12` som kanonisk dokumentrevision; en senare kvitto-/handoffcommit ändrar
inte kapitlens filhashar. Produktens `main` eller Bettalottos runtime har inte
deployats som del av dokumentationspubliceringen.

## Verifierat efter publicering

Vercels stabila adress visade **V5**, innehållsfingeravtryck **7b010e2b2054**.
Direktlänken till videouppladdning öppnade rätt kapitel/avsnitt. Åttadagarsplanen
visade Kevin/Emils uppgifter och alla åtta dagar. Sökning på läppsynk gav tre
avsnitt i planen och Rensa återställde navigationen. Desktoplayout granskades;
inga varningar/fel rapporterades i den kontrollerade webbflikens konsol.

Den autentiserade GitLab-wikin visade V5:s startsammanställning. Länken till
video-/triggerkapitlet öppnade hela instruktionen med exakta situationer,
urvalsregler, projektsparning och länkar till take-mallen och källfilen.

[GitHub Actions-körningen](https://github.com/Jakeminator123/animation-events-v1/actions/runs/35554963022)
för webbcommitten avslutades med **success**. Lokalt passerade webbens 17 tester,
reproducerbart HTML-bygge och synk av 44 filer utan drift mellan Croupier,
webbkopia och wikikopia. Publiceringsbygget inkluderar V4:s märkta historik.

## Kodkontroll och bevarat lokalt arbete

297 labbtester, Next-produktionsbygge med typkontroll, alla kommandon i
`.githooks/pre-commit` och `audit-dealer-sync --probe` passerade. V5:s nya
test prövar greeting-upload/återläsning/koppling och hindrar samma film för win.
Detta är ingen ny visuell/läppsynkacceptans av mediefilerna.

Råkopior i Jakobs loggmapp, observationer, lokala labbmedia, credentials och
andra pågående filer lämnades utanför Git. Det äldre lokala webbcheckoutets
osparade `s00-helheten.md` bevarades; publiceringen gjordes i separat kopia.
Källkodspush gör inte lokalt uppladdade filmer till teamgemensamma filer.

OpenClaws produktägarskap, Kevin/Emils läppsynkintegration, faktiskt driftsatt
spelrevision och full live-/visuell QA är fortsatt avgränsade nästa leveranser.
Jira CAC-status ändrades inte. Inga direktmeddelanden skickades; uppdragen och
instruktionerna publicerades på de av Jakob angivna wiki-/webbytorna.
