# Lissabon stream lane · Astrid

Vår fortsatta lokala demoingång: Emils filmer, gemensamma klippval,
idle-reaktioner, OpenClaw-chatten och ElevenLabs/RunPod-svar med läppsynk
i samma bildformat. Basversion före paketering: `e46bc8b`.
Milstolpetagg: **`BRA_sammanbindning_av_KJE`** på `jakeminator123/work`.

## Starta

1. Dubbelklicka **Start-Lissabon.cmd** här eller i projektroten.
2. Starten bygger labbet och öppnar <http://127.0.0.1:4201/lissabon>.
3. Tryck **Anslut**. Astrid öppnas i en spelflik som följs av labbets logg.
   Spela och chatta där. Välj mobilstorlek i webbläsaren för mobilgranskning.
4. Behåll startfönstret öppet. **Ctrl+C** stoppar båda servrarna.

```powershell
node lissabon/start.mjs
node lissabon/start.mjs --check
```

`--check` provar befintliga privata anslutningar utan att starta spelet eller
generera tal. `--no-open` används från Codex. `--skip-build` är bara för
utveckling efter ett verifierat `npm --prefix lab run build`.
En redan körande Lissabon öppnas igen. Andra processer på 4200/4201 stoppas
aldrig automatiskt; avsluta deras startprocess först.

Kräver Node 22.16+ med SQLite-stöd, `npm --prefix lab ci`, Emils befintliga
mediefiler och projektets privata miljöinställningar. Nycklar kopieras inte
hit. Se [anslutningsguiden](../open-claw/lab/docs/LOCAL-CONNECTION-SV.md).
Nya chattsvar använder konfigurerade modell-, ljud- och videotjänster.

## Arbetsytan

- **Ström:** Astrid och verkliga beslut och uppspelningskvitton.
- **Idle:** basloopar, automatiska variationer och OpenClaw-reaktioner,
  inklusive `idle_insulted`. Spara och ladda om spelfliken efter ändring,
  när handen är avslutad.
- **Klipp & varianter:** exakta filer per utdelning/replik och tillåtna
  alternativ. Sparade val läses vid nästa deal- eller replikhändelse.

Web är ensam spelare. Chattsvar genereras i spelet. Manuella klipp- och
idleförhandsvisningar är granskning, inte en andra spelström. Den äldre
studion finns kvar under `/tree` för avancerat arbete.

## Sparande

- `profile.json`: Astrid, portar, genererat tal och källversion. OpenClaw är
  standardklippval i denna körprofil; andra startvägar behåller sina val.
- `project.snapshot.json`: fryst projekt från den fungerande strömmen.
  Första start kopierar det till `data/project.json`. Befintliga ändringar
  skrivs aldrig över. Det gemensamma schemat innehåller fyra dealers;
  Lissabons arbetsyta är begränsad till Astrid.
- `data/project.json` och `data/history/`: lokala inställningar och
  revisionskopior överlever omstart men ligger utanför Git. Säkerhetskopiera
  dem separat eller gör en granskad ny snapshot vid nästa milstolpe.
- Demodatabas, spelare, chattminne och genererade svar är tillfälliga per
  serverstart i en separat Windows Temp-mapp. Normal avstängning rensar den.
  Den verkliga användardatabasen används inte.

## Gemensamma källor

Ingen kopierad spelmotor eller extra videoarkiv:

- [Emils manifest](../emil/dealklipp-v1/lab-video-manifest.json) och
  `emil/dealklipp-v1/{deal,idle,repliker}/`: filmer, familjer och varianter.
- [Arbetsytan](../lab/components/lissabon-studio.tsx) och
  [gemensam runtime](../presentation-runtime/): editor och beslut.
- [Produktkoppling](../web/presentation-api.mjs),
  [lokal filmspelare](../web/public/local-presentation.mjs) och
  [genererat tal](../web/public/generated-speech-player.mjs).
- [Isolerad start](../open-claw/lab/deploy/local-connection.mjs): befintliga
  privata anslutningar; Web och Lab läser samma absoluta `lissabon/data`.

Git-taggen låser kod, snapshot och mediereferenser. Den packar inte privata
nycklar, externa tjänster eller lokala filer som inte ligger i Git.

## Känt inför demo

Chattsvar genereras färdigt innan uppspelning. Tidigare prov tog 15–25
sekunder; Lissabon-provet tog 81 sekunder. Planera för varierande väntetid. Utdelning går före tal. Bildformatet är verifierat; röstens
naturlighet och fonemvis läppsynk är inte slutgodkända.
Mobilchatten kan täcka ansiktet, talfilmen kan täcka kortöverlägg och
kortkontakt behöver kalibreras. Detta är en säkrad utvecklingsmilstolpe.
Se [handoffen](../docs/JOHN-HANDOFF.md) för prov och kvarvarande fel.
