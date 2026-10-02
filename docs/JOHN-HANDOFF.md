# Aktuellt arbete och kvarvarande verifiering

Uppdaterad 2 oktober 2026. Kort aktuell handoff; äldre rapporter har rensats
på Jakobs begäran. Media, JSON-kvitton, kalibreringar och baseline bevaras.
Uppdatera denna fil i stället för att skapa fler arbetsrapporter.

## Senaste administrativa ändring

`main` är enda lokala/GitHub-branch i `Jakeminator123/github-work`.
Övriga brancher saknade egna commits och den gamla rena worktreen är borta.
Vercel och fyra Render-kopplingar följer `main` med bevarade autodeploylägen.
Leverans `61241a09`: grön full hook, tre gröna CI-jobb och READY i Vercel.
GitLab förblir pausat.

Dokumentationsrensningen behåller fem Markdown-filer under `docs`.
GitLab-inboxinstruktioner ersätts med pausstatus; navigationen är uppdaterad.
Sök-/Cursor-ignore omfattar beroenden, byggcache, binärer och privat data.
Ingen produktkod, media, databas, GPU-budget eller testhook har ändrats.
Kontroll: 99 → 5 filer, cirka 98 procent mindre dokumentationstext;
inga ändrade JSON-/mediekvitton eller trasiga docs-länkar. Riktade
env-/GitHub-policytester passerar (9/9); full hook körs vid commit.

## Snabbare verifiering och katalogrensning — 2 oktober

Rena dokumentations-/index-ignore-commits får ett snabbt spår med envregister,
GitHub-pausskydd, hookregressioner och staged whitespace-kontroll.
Kod, test, konfiguration, runtime-prompter och media använder hela befintliga
regressionen. Tomt index, CI och explicit --full väljer också full kontroll.
CI anger --full; de ursprungliga 32 stegen ligger i .githooks/pre-commit-full.
Verklig staged docs-körning tog 1,393 s mot tidigare fulla 68,55 s;
17 snabba kontroller passerade. Oberoende designgranskning hittade inget
falskt snabbspår; alla 32 ursprungliga kommandon finns kvar.
Nya tester verifierar bland annat kod→docs-rename, blandade ändringar och
misslyckade delkommandon utan att röra produktens data.

Underagenter tog bort tomma rot-reference och tolv tomma docs-kataloger.
docs/reference bevaras: kamera, spelarmål, ankare och bilder används av
medieunderlag. test/ är aktiv (76 testfiler i hook, ytterligare 7 i CI).
Endast den avvecklade GitLab-wikihelpern och dess enda test togs bort;
de saknade aktiva konsumenter och hänvisade till raderade sprintdokument.
GitHub-/inbox-pausskydden finns kvar (25 riktade tester godkända).
Inga servrar, betaljobb, media eller databaser ändrades.

## Fortsatt rensning — 2 oktober

random-stuff-jakob/ är borttagen på Jakobs begäran. Mappen saknade spårade
filer och aktiva konsumenter; kvarvarande ignorerad åtkomstnotis raderades
utan innehållsläsning. Det pensionerade arkivet fanns inte i checkouten.
Dess tidigare läsgräns och ignore-skydd gäller om material återställs.

ANDRINGSLOGG-V2.md är borttagen: dess 29-septemberstatus om branch,
Render-start och GPU-publicering var ersatt av denna aktuella handoff.
Behållen beslutsgräns: vanlig inloggning och förinspelat spel ska inte starta
GPU. GPU-vila får inte logga ut spelaren, radera sparande eller avbryta
ekonomiska transaktioner. Gamla föreslagna timeoutvärden är inte driftkontrakt.

pipeline/ och content/ bevaras efter källgranskning. Pipeline bygger och
granskar video-/medieregister och används av Lab, hook och CI. Content har
original, dealerreferenser och kalibrerings-/stagingunderlag som aktiva
tester och produktens dealerinventering använder. Inga mediabytes ändrades.

## Intro och startsida

Datorintrot publicerades i `033b97a9`, livekontroll i `64c903ab`.
Hela walk→drag→natural spelades med ökande videotid; overlay och videonoder
var borta efter avslut. 10 fokustester, TypeScript, produktionsbygge och
fyrdealeraudit passerade. Mobil/surfplatta laddar inte introfilmer; iPad med
desktop-useragent är också exkluderad. Fysisk mobil/Safari återstår.

Startsidesdarr/flimmer är undersökt men inte ändrat. Perspektivgolv,
parallax och kortjolt är möjliga orsaker; inga konsolfel eller kvarvarande
intro-overlay sågs. Orsaken är inte slutbevisad.

## Senaste röstprov

1 oktober 11:48–11:53 UTC: Render `6c24b4a5`, RunPod release 4 med färgfix
`66b07a7c`, två lyckade svar utan 404 eller Voice off. Bild vid 1 och 3 sekunder
i båda inspelningar saknade tidigare magenta/gröna mask. Två skilda
GPU-sessioner fick genuina `CANCELLED`-kvitton. Första totalen var 104,803 s,
första bild 99,917 s; andra totalen 14,187 s, första bild 7,723 s.
Detta verifierar färgfix och sessionsavslut, inte exakt fonemsynk.

Privata inspelningar utanför Git i `C:\Users\jakem\Downloads`:

| Fil | SHA-256 |
| --- | --- |
| `astrid-qa-turn-1 (2).webm` | `2c12ff37bdc4491e1944e000e00de498cab6f3a8e29250ea6b96d2b2d7bd5987` |
| `astrid-qa-turn-2 (1).webm` | `b091dff159deab06e17e89548840077043473f890e77e6dc0de1882e7e7a69f1` |

Provgrinden är borta; noll QA-identiteter, väntande arbete och relay-workers.
Försöks-/budgetjournaler behölls: USD 3,00 reserverat, inte uppmätt faktura;
dygnstak USD 9,94, sessionsreserv USD 0,50, worker min 0/max 1.
Inga automatiska betalda omförsök eller ändringar av gamla journaler.

Kvar: lång kallstart, exakt läppsynk, verklig mikrofon-till-svar, fysisk
mobil/Safari, extern återläsbar produktionsbackup och full zonlagringsacceptans.
Nya GPU-prov kräver uttryckligt avgränsad kampanj och bevarad förbrukad budget.

## Speldata och medieacceptans

Konton/saldo ligger i SQLite; Neon används för zonmetadata. OpenClaw får
begränsad publik spelar-/samtalskontext, ingen direkt saldoåtkomst.
Publik lösenordsåterställning och game-Neon-migration är inte införda.
Råfilmernas kortkontakt är inte kalibrerad; 2D-landning kan rapportera
`calibratedContact: false`. Saknad exakt film använder uttrycklig reserv.
Gamla godkännanden överförs inte till media med annan hash.
Följ [återställning och medieregler](ENVIRONMENT-RESTORATION.md).

## Uppmätt väntetid

2 oktober: cirka 46 GiB ledigt RAM, CPU 0–14 %, ingen diskkö och inga lokala
produkt-/labbservrar. Git-status tog 84–124 ms. Hookens 32 steg tog 68,55 s
(656 godkända tester, 0 fel, 1 plattformsskip); den körs även för docs.
Ett tidigare browseranrop tog 173,8 s. Agent-talks syntetiska låstest hade
intermittent Windows-EPERM; tre riktade omkörningar och senare full hook passerade.
Den tidigare fulla hooken har nu ett separat snabbspår för docs. Rensningen minskar sök-/kontextbrus; den bevisar inte
att Codex kör en bakgrundsindexerare eller att modell-/serverväntan försvinner.